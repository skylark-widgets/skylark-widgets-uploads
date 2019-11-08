/**
 * skylark-widgets-uploads - The skylark file upload  widget library
 * @author Hudaokeji, Inc.
 * @version v0.9.0
 * @link https://github.com/skylark-widgets/skylark-widgets-uploads/
 * @license MIT
 */
(function(factory,globals) {
  var define = globals.define,
      require = globals.require,
      isAmd = (typeof define === 'function' && define.amd),
      isCmd = (!isAmd && typeof exports !== 'undefined');

  if (!isAmd && !define) {
    var map = {};
    function absolute(relative, base) {
        if (relative[0]!==".") {
          return relative;
        }
        var stack = base.split("/"),
            parts = relative.split("/");
        stack.pop(); 
        for (var i=0; i<parts.length; i++) {
            if (parts[i] == ".")
                continue;
            if (parts[i] == "..")
                stack.pop();
            else
                stack.push(parts[i]);
        }
        return stack.join("/");
    }
    define = globals.define = function(id, deps, factory) {
        if (typeof factory == 'function') {
            map[id] = {
                factory: factory,
                deps: deps.map(function(dep){
                  return absolute(dep,id);
                }),
                resolved: false,
                exports: null
            };
            require(id);
        } else {
            map[id] = {
                factory : null,
                resolved : true,
                exports : factory
            };
        }
    };
    require = globals.require = function(id) {
        if (!map.hasOwnProperty(id)) {
            throw new Error('Module ' + id + ' has not been defined');
        }
        var module = map[id];
        if (!module.resolved) {
            var args = [];

            module.deps.forEach(function(dep){
                args.push(require(dep));
            })

            module.exports = module.factory.apply(globals, args) || null;
            module.resolved = true;
        }
        return module.exports;
    };
  }
  
  if (!define) {
     throw new Error("The module utility (ex: requirejs or skylark-utils) is not loaded!");
  }

  factory(define,require);

  if (!isAmd) {
    var skylarkjs = require("skylark-langx/skylark");

    if (isCmd) {
      module.exports = skylarkjs;
    } else {
      globals.skylarkjs  = skylarkjs;
    }
  }

})(function(define,require) {

define('skylark-widgets-uploads/uploads',[
  "skylark-langx/skylark"
],function(skylark){
	return skylark.attach("widgets.updates",{});
});
define('skylark-widgets-uploads/MultiUploader',[
  "skylark-langx/skylark",
  "skylark-langx/langx",
  "skylark-domx-query",
  "skylark-net-http/Upload",
  "skylark-widgets-base/Widget",
  "./uploads"
]  ,function(skylark,langx,$, FileUpload, Widget,uploads){

    var fileListTemplate = '<div class="lark-multiuploader">' + 
        '    <h3 class="popover-title">Upload files</h3>' + 
        '    <div class="popover-content container-fluid" class="file-list file-dropzone file-pastezone">' + 
        '        <div class="no-data"><em>Add files.</em></div>' + 
        '    </div>' + 
        '    <footer>' + 
        '        <button class="btn btn-warning pull-right btn-sm" id="cancel-uploads-button"><i class="icon-cancel"></i>Cancel uploads</button>' + 
        '        <span class="btn btn-success fileinput-button btn-sm" id="fileinput-button">' + 
        '            <i class="icon-plus"></i>' + 
        '            <span>Add files...</span>' + 
        '            <input id="fileupload" type="file" name="files[]" multiple="multiple">' + 
        '        </span>' + 
        '        <button class="btn btn-primary btn-sm" id="start-uploads-button"><i class="icon-start"></i>Start uploads</button>' + 
        '    </footer>' + 
        '</div>',
        fileItemTemplate = '<div class="file-item row">' +
        '   <div class="col-md-6"><span class="name"></span></div>' + 
        '   <div class="col-md-3">' +
        '    <span class="size"></span>' +
        '    <div class="progress hidden">' +
        '        <div class="progress-label"></div>' +
        '        <div class="bar"></div>' +
        '    </div>' +
        '    <span class="message hidden"></span>' +
        '   </div>' +
        '   <div class="col-md-3">' +
        '    <button class="btn btn-warning btn-xs cancel"><i class="icon-remove"></i>Cancel</button>' +
        '    <button class="btn btn-xs clear hidden">Clear</button>' +
        '   </div>' +
        '</div>';

    var MultiUploader =  Widget.inherit({
        klassName : "Uploader",
        pluginName : "lark.multiuploader",

        options: {
            uploadUrl: '/upload',

        	params: {
                formParamName : "file"
            },

    	    maxConnections: 3,
        	// validation
        	allowedExtensions: [],
        	sizeLimit: 0,
        	minSizeLimit: 0,

            autoUpload: false,
            selectors : {
              fileList : ".file-list",
              fileItem : ".file-item",
              nodata : ".file-list .no-data",

              picker   : ".file-picker",
              dropzone : ".file-dropzone",
              pastezone: ".file-pastezone",

              startUploads: '.start-uploads',
              cancelUploads: '.cancel-uploads',
            },

            template : fileListTemplate,

            dataType: 'json',

            fileItem : {
            	selectors : {
                    name : ".name",
                    size : ".size",
                    cancel: ".cancel",
                    clear : ".clear",
                    progress : ".progress",
                    message : ".message"                   
            	},

            	template : fileItemTemplate
            }
        },

        state : {
        },

        _init: function () {
            var self = this;


            // Render current files
            /*
            this.files.forEach(function (file) {
                self.renderFile(file);
            });
            */

            //this._refresh({files:true});
        

            //this._files.on('all', function(){
            //  self._refresh({files:true});
            //});

            this._initEventHandler();
            this._initFileHandlers();
            this._initUpoadHandler();
            this._updateFileList();
        },

        _initFileHandlers : function() {
            var self = this;

            var selectors = this.options.selectors,
            	dzSelector = selectors.dropzone,
            	pzSelector = selectors.pastezone,
            	pkSelector = selectors.picker;

            if (dzSelector) {
				this._velm.$(dzSelector).dropzone({
	                dropped : function (files) {
                        self._addFiles(files);
	                }
				});
            }


            if (pzSelector) {
                this._velm.$(pzSelector).pastezone({
                    pasted : function (files) {
                        self._addFiles(files);
                    }
                });                
            }

            if (pkSelector) {
                this._velm.$(pkSelector).picker({
                    multiple: true,
                    picked : function (files) {
                        self._addFiles(files);
                    }
                });                
            }
        },

        _initUpoadHandler: function(){
            var self = this,
                handlerClass;

            this._handler = new FileUpload({
                url: this.options.uploadUrl,
                maxConnections: this.options.maxConnections,
                onProgress: function(id, fileName, loaded, total){
                    self._onProgress(id, fileName, loaded, total);
                },
                onComplete: function(id, fileName, result){
                    self._onComplete(id, fileName, result);
                },
                onCancel: function(id, fileName){
                    self._onCancel(id, fileName);
                },
                onFailure: function(id,fileName,e){
                    self._onFailure(id,fileName,e);
                }
            });
        },
        
         /**
         * delegate click event for cancel link
         **/
        _initEventHandler: function(){
            var self = this,
               selectors = this.options.selectors,
               itemSelectors = this.options.fileItem.selectors, 
               list = this._listElement;

            // Add cancel handler
            this._velm.$(selectors.fileList).on("click",itemSelectors.cancel,function(e){
                var $fileItem = $(this).closest(selectors.fileItem),
                    fileId = $fileItem.data("fileId");
                self._handler.cancel(fileId);
                $fileItem.remove();
                self._updateFileList();
            });

            // Add clear handler
            this._velm.$(selectors.fileList).on("click",itemSelectors.clear,function(e){
                var $fileItem = $(this).closest(selectors.fileItem),
                    fileId = $fileItem.data("fileId");
                $fileItem.remove();
                self._updateFileList();
            });

            // Add cancel all handler
            this._velm.$(selectors.cancelUploads).click(function(){
                var $files = self._velm.$(selectors.fileList).find(selectors.fileItem);           
                $files.forEach(function(fileItem){
                    var $fileItem = $(fileItem),
                        fileId = $fileItem.data("fileId");
                    self._handler.cancel(fileId);
                    $fileItem.remove();
                });
                self._updateFileList();

            });

            // Add start uploads handler
            this._velm.$(selectors.startUploads).click(function(){
                var $files = self._velm.$(selectors.fileList).find(selectors.fileItem);           
                $files.forEach(function(fileItem){
                    var $fileItem = $(fileItem),
                        fileId = $fileItem.data("fileId");
                    if (!$fileItem.data("status")) {
                        // The file has not yet been sent
                        self._handler.send(fileId,self.options.params);
                    }
                });

            });
            

        },       

        _onProgress: function(id, fileName, loaded, total){          
            var $item = this._getItemByFileId(id);

            var percent = parseInt(loaded / total * 100, 10);
            var progressHTML = this._formatSize(loaded)+' of '+ this._formatSize(total);

            $item.data("status","running");
            $item.find('.progress')
                .find('.bar')
                .css('width', percent+'%')
                .parent()
                .find('.progress-label')
                .html(progressHTML);
            this._updateFile($item);

        },

        _onComplete: function(id, fileName, result){
            this._filesInProgress--;
            var $item = this._getItemByFileId(id);
            $item.data("status","done");
            $item.find('.message').html('<i class="icon-success"></i> ' + (this.doneMsg || 'Uploaded'));
            this._updateFile($item);
        },

        _onFailure : function(id,fileName,e) {
            this._filesInProgress--;
            var $item = this._getItemByFileId(id);
            $item.data("status","error");
            $item.find('.message').html('<i class="icon-error"></i> ');;
            this._updateFile($item)

        },

        _onCancel: function(id, fileName){
            this._filesInProgress--;
            var $item = this._getItemByFileId(id);
            $item.data("status","cancel");
            this._updateFile($item)
        },

        _addToList: function(id, fileName){
            var self = this;


            var fileName = this._handler.getName(id),
                fileSize = this._handler.getSize(id);

            var item = $(this.options.fileItem.template);
            item.data("fileId",id);

            item.find(this.options.fileItem.selectors.name).html(this._formatFileName(fileName));
            item.find(this.options.fileItem.selectors.size).html(this._formatSize(fileSize));

            this._velm.$(this.options.selectors.fileList).append(item);

            this._updateFileList();
        },
    
        _updateFileList : function ()  {
            var selectors = this.options.selectors,
                itemSelectors = this.options.fileItem.selectors,
                files = this._velm.$(selectors.fileList).find(selectors.fileItem);

            var with_files_elements = this._velm.$(selectors.cancelUploads + ',' + selectors.startUploads);
            var without_files_elements = this._velm.$(selectors.nodata);
            if (files.length > 0) {
                with_files_elements.removeClass('hidden');
                without_files_elements.addClass('hidden');
            } else {
                with_files_elements.addClass('hidden');
                without_files_elements.removeClass('hidden');
            }
        },
        
        _updateFile: function ($item) {
            var selectors = this.options.fileItem.selectors,
                when_pending = $item.find(selectors.size + "," + selectors.cancel),
                when_running = $item.find(selectors.progress + "," + selectors.cancel),
                when_done = $item.find(selectors.message + "," + selectors.clear);

            var status = $item.data("status");    
            if (status == "pending") {
                when_running.add(when_done).addClass('hidden');
                when_pending.removeClass('hidden');
            } else if (status == "running") {
                when_pending.add(when_done).addClass('hidden');
                when_running.removeClass('hidden');
            } else if (status == "done" || status == "error") {
                when_pending.add(when_running).addClass('hidden');
                when_done.removeClass('hidden');
            }
        },

        _getItemByFileId: function(id){
            var selectors = this.options.selectors,
                files = this._velm.$(selectors.fileList).find(selectors.fileItem),
                item;

            // there can't be txt nodes in dynamically created list
            // and we can  use nextSibling

            for (var i = 0; i<files.length;i++){
                var item2 = files[i];
                if ($(item2).data("fileId") == id) {
                    item = item2;
                    break;
                }
            }
            if (item) {
                return $(item);
            }
        },


            
        _addFiles: function(files){
            for (var i=0; i<files.length; i++){
                if ( !this._validateFile(files[i])){
                    return;
                }
            }

            for (var i=0; i<files.length; i++){
                this._addFile(files[i]);
            }
        },

        _addFile: function(file){
            var id = this._handler.add(file);

            this._filesInProgress++;
            this._addToList(id);

            //this._handler.upload(id, this.options.params);
        },

        _validateFile: function(file){
            var name, size;

            if (file.value){
                // it is a file input
                // get input value and remove path to normalize
                name = file.value.replace(/.*(\/|\\)/, "");
            } else {
                // fix missing properties in Safari
                name = file.fileName != null ? file.fileName : file.name;
                size = file.fileSize != null ? file.fileSize : file.size;
            }

            if (! this._isAllowedExtension(name)){
                this._error('typeError', name);
                return false;

            } else if (size === 0){
                this._error('emptyError', name);
                return false;

            } else if (size && this.options.sizeLimit && size > this.options.sizeLimit){
                this._error('sizeError', name);
                return false;

            } else if (size && size < this.options.minSizeLimit){
                this._error('minSizeError', name);
                return false;
            }

            return true;
        },

        _error: function(code, fileName){
            var message = this.options.messages[code];
            function r(name, replacement){ message = message.replace(name, replacement); }

            r('{file}', this._formatFileName(fileName));
            r('{extensions}', this.options.allowedExtensions.join(', '));
            r('{sizeLimit}', this._formatSize(this.options.sizeLimit));
            r('{minSizeLimit}', this._formatSize(this.options.minSizeLimit));

            this.options.showMessage(message);
        },

        _formatFileName: function(name){
            if (name.length > 33){
                name = name.slice(0, 19) + '...' + name.slice(-13);
            }
            return name;
        },

        _isAllowedExtension: function(fileName){
            var ext = (-1 !== fileName.indexOf('.')) ? fileName.replace(/.*[.]/, '').toLowerCase() : '';
            var allowed = this.options.allowedExtensions;

            if (!allowed.length){return true;}

            for (var i=0; i<allowed.length; i++){
                if (allowed[i].toLowerCase() == ext){ return true;}
            }

            return false;
        },

        _formatSize: function(bytes){
            var i = -1;
            do {
                bytes = bytes / 1024;
                i++;
            } while (bytes > 99);

            return Math.max(bytes, 0.1).toFixed(1) + ['KB', 'MB', 'GB', 'TB', 'PB', 'EB'][i];
        }

    });


	return uploads.MultiUploader = MultiUploader;
});
define('skylark-widgets-uploads/main',[
	"./uploads",
	"./MultiUploader"
],function(uploads){
	return uploads;
});
define('skylark-widgets-uploads', ['skylark-widgets-uploads/main'], function (main) { return main; });


},this);
//# sourceMappingURL=sourcemaps/skylark-widgets-uploads.js.map
