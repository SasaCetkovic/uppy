const html = require('yo-yo')
const Plugin = require('../Plugin')
const FtpProvider = require('./FtpProvider')
const View = require('../../generic-provider-views')
const icons = require('./icons')
const Utils = require('../../core/Utils')

module.exports = class Ftp extends Plugin {
  constructor (core, opts) {
    super(core, opts)
    this.type = 'acquirer'
    this.id = 'Ftp'
    this.title = 'Ftp'
    this.stateId = 'ftp'

    this.icon = () => html`
      <svg class="UppyIcon" width="128" height="118" viewBox="0 0 128 118">
        <path d="M38.145.777L1.108 24.96l25.608 20.507 37.344-23.06z"/>
        <path d="M1.108 65.975l37.037 24.183L64.06 68.525l-37.343-23.06zM64.06 68.525l25.917 21.633 37.036-24.183-25.61-20.51z"/>
        <path d="M127.014 24.96L89.977.776 64.06 22.407l37.345 23.06zM64.136 73.18l-25.99 21.567-11.122-7.262v8.142l37.112 22.256 37.114-22.256v-8.142l-11.12 7.262z"/>
      </svg>
    `

    this.initiated = false

    // writing out the key explicitly for readability the key used to store
    // the provider instance must be equal to this.id.
    this[this.id] = new FtpProvider(core, opts)

    this.files = []
    this.onAuth = this.onAuth.bind(this)
    this.render = this.render.bind(this)

    // set default options
    const defaultOptions = {}

    // merge default options with the ones set by user
    this.opts = Object.assign({}, defaultOptions, opts)
  }

  install () {
    this.view = new View(this)
    // Set default state
    this.setPluginState({
      authenticated: false,
      files: [],
      folders: [],
      directories: [],
      activeRow: -1,
      filterInput: '',
      isSearchVisible: false
    })

    // View overrides
    // ==============
    // These are needed as the generic provider methods written
    // differ the ones needed for this plugin
    this.view.handleAuth = this.handleAuth.bind(this)
    this.view.getFolder = this.getFolder.bind(this)
    this.view.logout = this.logout.bind(this)
    this.view.addFile = this.addFile.bind(this)

    const target = this.opts.target
    if (target) {
      this.mount(target, this)
    }
  }

  handleAuth () {
    this.setPluginState({loading: true})
    this.getFolder()
  }

  onAuth (authenticated) {
    this.setPluginState({ authenticated })
    if (authenticated) {
      this.getFolder()
    }
  }

  uninstall () {
    this.unmount()
  }

  isFolder (item) {
    return item.is_dir
  }

  getItemData (item) {
    return Object.assign({}, item, {size: item.file_size})
  }

  getItemIcon (item) {
    return icons['page_white']
  }

  getItemSubList (item) {
    return item.contents
  }

  getItemName (item) {
    return item.file_name
  }

  getMimeType (item) {
    return item.mime_type
  }

  getItemId (item) {
    return item.rev
  }

  getItemRequestPath (item) {
    return encodeURIComponent(this.getItemName(item))
  }

  getItemModifiedDate (item) {
    return item.modified
  }

  getItemThumbnailUrl (item) {
    return this.opts.fileThumb
  }

  getFolder () {
    this.view._loaderWrapper(
      this.Ftp.list(''),
      (resp) => {
        if (resp.Status === 'Error') {
          throw new Error(resp.Message)
        }

        for (let file of resp.Data.Files) {
          file.acquirer = this.id
        }
        // Success - display files
        this.setPluginState({
          files: resp.Data.Files,
          authenticated: true,
          loading: false
        })
      },
      this.view.handleError)
  }

  // this function replaces the role of the function with the same name
  // in generic-provider-views
  addFile (file, isCheckbox = false) {
    const tagFile = {
      source: this.id,
      data: this.getItemData(file),
      name: this.getItemName(file),
      // type: this.getMimeType(file),
      preview: this.getItemThumbnailUrl(file),
      isRemote: true,
      body: {
        fileId: this.getItemId(file)
      },
      remote: {
        host: this.opts.host,
        url: '',
        body: {
          fileId: this.getItemId(file)
        }
      }
    }

    this.core.log('Adding remote file')
    this.core.addFile(tagFile)

    if (!isCheckbox) {
      this.view.donePicking()
    }

    setTimeout((tagFile) => {
      // need this hack to skip setting the FTP files on "paused upload"
      // (i.e. adding them in the waitingFileIDs collection in Core.js upload() function)
      let fileId = Utils.generateFileID(tagFile)
      let updatedFile = this.setFileRemoteStatusToFalse(fileId)

      // the actual upload is done elsewhere in backend, we only simulate here
      this.core.emitter.emit('core:upload-success', fileId, updatedFile, '')
    }, 1500, tagFile)
  }

  setFileRemoteStatusToFalse (fileId) {
    const updatedFiles = Object.assign({}, this.core.getState().files)
    const updatedFile = Object.assign({}, updatedFiles[fileId], {
      isRemote: false
    })
    updatedFiles[fileId] = updatedFile

    this.core.setState({
      files: updatedFiles
    })

    return updatedFile
  }

  logout () {
    this.setPluginState({ authenticated: false })
  }

  render (state) {
    if (!this.initiated) {
      this.initiated = true
      this.handleAuth()
    }

    return this.view.render(state)
  }
}
