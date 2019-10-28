define([
  "skylark-langx/langx",
  "skylark-data-collection/ArrayList",
  "./domx/uploader",
  "skylark-domx-query",
  "skylark-widgets-base/Widget",
  "./filer"
]  ,function(langx,ArrayList,uploader, $, Widget,filer){

    function displaySize(bytes) {
        var sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        if (bytes == 0) return '0 B';
        var i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
        return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + sizes[i];
    }
    function displayDate(timestamp) {
        return new Date(timestamp).toLocaleString();
    }
    /**
     * This model represents a file.
     *
     */
    var FileItem = langx.Stateful.inherit({
        state: "pending",

        /**
         * Start upload.
         *
         */
        start: function ()  {
            if (this.isPending()) {
                this.get('processor').submit();
                this.state = "running";

                // Dispatch event
                this.trigger('filestarted', this);
            }
        },

        /**
         * Cancel a file upload.
         *
         */
        cancel: function () {
            this.get('processor').abort();
            this.destroy();

            // Dispatch event
            this.state = "canceled";
            this.trigger('filecanceled', this);
        },

        /**
         * Notify file that progress updated.
         *
         */
        progress: function (data)  {
            // Dispatch event
            this.trigger('fileprogress', this.get('processor').progress());
        },

        /**
         * Notify file that upload failed.
         *
         */
        fail: function (error)  {
            // Dispatch event
            this.state = "error";
            this.trigger('filefailed', error);
        },

        /**
         * Notify file that upload is done.
         *
         */
        done: function (result)  {
            // Dispatch event
            this.state = "error";
            this.trigger('filedone', result);
        },

        /**
         * Is this file pending to be uploaded ?
         *
         */
        isPending: function ()  {
            return this.getState() == "pending";
        },

        /**
         * Is this file currently uploading ?
         *
         */
        isRunning: function () {
            return this.getState() == "running";
        },

        /**
         * Is this file uploaded ?
         *
         */
        isDone: function () {
            return this.getState() == "done";
        },

        /**
         * Is this upload in error ?
         *
         */
        isError: function () {
            return this.getState() == "error" || this.getState == "canceled";
        },

        /**
         * Get the file state.
         *
         */
        getState: function () {
            return this.state;
        }
    });

    /**
     * This is a file collection, used to manage the selected
     * and processing files.
     *
     */
    var FileItemCollection = ArrayList.inherit({
        item: FileItem
    });

    /**
     * A file view, which is the view that manage a single file
     * process in the upload manager.
     *
     */
    var FileItemWidget = Widget.inherit({
        className: 'upload-manager-file row',

        options : {
          selectors : {
            fileName : ".name",
            fileSize : ".size",
            cancel : ".cancel",
            clear : ".clear",
            progress : ".progress",
            message : ".message"
          }
        },

        state : {
          fileName : String,
          fileSize : Number
        },

        _init: function () {
            this.processUploadMsg = this.options.processUploadMsg;
            this.doneMsg = this.options.doneMsg;

            this.model = this.options.model;

            this.fileName(this.options.fileName);
            this.fileSize(this.options.fileSize);

            // Bind model events
            this.model.on('destroy', this.close, this);
            this.model.on('fileprogress', this.updateProgress, this);
            this.model.on('filefailed', this.hasFailed, this);
            this.model.on('filedone', this.hasDone, this);

            // In each case, update view
            this.model.on('all', this.update, this);

            // Bind events
            //this.bindEvents();

            // Update elements
            this.update();            
        },

        _refresh : function(updates) {

        },

        /**
         * Update upload progress.
         *
         */
        updateProgress: function (progress) {
            var percent = parseInt(progress.loaded / progress.total * 100, 10);
            var progressHTML = displaySize(progress.loaded)+' of '+ displaySize(progress.total);
            if (percent >= 100 && this.processUploadMsg) { progressHTML = this.processUploadMsg; }

            this._velm.$('.progress')
                .find('.bar')
                .css('width', percent+'%')
                .parent()
                .find('.progress-label')
                .html(progressHTML);
        },

        /**
         * File upload has failed.
         *
         */
        hasFailed: function (error){
            this._velm.$('.message').html('<i class="icon-error"></i> '+error);
        },

        /**
         * File upload is done.
         *
         */
        hasDone: function (result){
            this._velm.$('.message').html('<i class="icon-success"></i> ' + (this.doneMsg || 'Uploaded'));
        },

        /**
         * Update view without complete rendering.
         *
         */
        update: function () {
            var selectors = this.options.selectors,
                when_pending = this._velm.$(selectors.size + "," + selectors.cancel),
                when_running = this._velm.$(selectors.progress + "," + selectors.cancel),
                when_done = this._velm.$(selectors.message + "," + selectors.clear);

            if (this.model.isPending()) {
                when_running.add(when_done).addClass('hidden');
                when_pending.removeClass('hidden');
            } else if (this.model.isRunning()) {
                when_pending.add(when_done).addClass('hidden');
                when_running.removeClass('hidden');
            } else if (this.model.isDone() || this.model.isError()) {
                when_pending.add(when_running).addClass('hidden');
                when_done.removeClass('hidden');
            }
        },

        /**
         * Startup widget with binding events
         * @override
         *
         */
        _startup: function () {
            var self = this;

            // DOM events
            this._velm.$(this.options.selectors.cancel).click(function(){
                self.model.cancel();
                self.collection.remove(self.model);
            });
            this._velm.$(this.options.selectors.clear).click(function(){
                self.model.destroy();
                self.collection.remove(self.model);
            });
        },

        /**
         * Compute data to be passed to the view.
         *
         */
        computeData: function () {
            return $.extend({
              displaySize : displaySize,
              displayDate : displayDate
            }, this.model.get('data'));
        }
    });


    var Uploader =  Widget.inherit({
        klassName : "Uploader",
        pluginName : "lark.uploader",

        options: {

            uploadUrl: '/upload',
            autoUpload: false,
            selectors : {
              fileList : '.file-list',
              nodata : ".file-list .no-data",
              pickFiles: '.file-picker',
              startUploads: '.start-uploads',
              cancelUploads: '.cancel-uploads',
            },

            dataType: 'json',

            fileItem : {
            	selectors : {

            	},

            	template : null
            }
        },

        state : {
        },

        /**
         * Render the main part of upload manager.
         *
         */
        _init: function () {
            var self = this;


            // Create the file list
            var files = this._files = new FileItemCollection();

            // Add add files handler
            var filePicker = this._velm.$(this.options.selectors.pickFiles), self = this;

            this.uploadProcess =  uploader(this._elm,{  //$.$(this.el).fileupload({
                dataType: this.options.dataType,
                url: this.options.uploadUrl,
                formData: this.options.formData,
                autoUpload: this.options.autoUpload,
                singleFileUploads: true,
                picker : filePicker,

                'add' : function (e, data) {
                    // Create an array in which the file objects
                    // will be stored.
                    data.uploadManagerFiles = [];

                    // A file is added, process for each file.
                    // Note: every times, the data.files array length is 1 because
                    //       of "singleFileUploads" option.
                    langx.each(data.files, function (index, file_data) {
                        // Create the file object
                        file_data.id = self.file_id++;
                        var file = new FileItem({
                            data: file_data,
                            processor: data
                        });

                        // Add file in data
                        data.uploadManagerFiles.push(file);

                        // Trigger event
                        //self.trigger('fileadd', file);
                        // Add it to current list
                        self._files.add(file);

                        // Create the view
                        self.renderFile(file);

                    });
                },
                'progress' : function (e, data) {
                    langx.each(data.uploadManagerFiles, function (index, file) {
                        //self.trigger('fileprogress', file, data);

                        file.progress(data);
                    });
                },

                'fail' : function (e, data) {
                    langx.each(data.uploadManagerFiles, function (index, file) {
                        var error = "Unknown error";
                        if (typeof data.errorThrown == "string") {
                            error = data.errorThrown;
                        } else if (typeof data.errorThrown == "object") {
                            error = data.errorThrown.message;
                        } else if (data.result) {
                            if (data.result.error) {
                                error = data.result.error;
                            } else if (data.result.files && data.result.files[index] && data.result.files[index].error) {
                                error = data.result.files[index].error;
                            } else {
                                error = "Unknown remote error";
                            }
                        }

                        //self.trigger('filefail', file, error);
                        file.fail(error);
                    });
                },

                'done' : function (e, data) {
                    langx.each(data.uploadManagerFiles, function (index, file) {
                        //self.trigger('filedone', file, data);
                        file.done(data.result);
                    });
                }

            });

            // Add upload process events handlers
            this.bindProcessEvents();

            // Add cancel all handler
            this._velm.$(this.options.selectors.cancelUploads).click(function(){
                while (self._files.length) {
                    self._files.at(0).cancel();
                }
            });

            // Add start uploads handler
            this._velm.$(this.options.selectors.startUploads).click(function(){
                self._files.forEach(function(file){
                    file.start();
                });
            });

            // Render current files
            /*
            this.files.forEach(function (file) {
                self.renderFile(file);
            });
            */

            this._refresh({files:true});
        

            this._files.on('all', function(){
              self._refresh({files:true});
            });

        },

        _refresh : function(updates) {
            var self = this;
            function updateFileList()  {
                var selectors = self.options.selectors,
                    files = self._files;
                var with_files_elements = self._velm.$(selectors.cancelUploads + ',' + selectors.startUploads);
                var without_files_elements = self._velm.$(selectors.nodata);
                if (files.count() > 0) {
                    with_files_elements.removeClass('hidden');
                    without_files_elements.addClass('hidden');
                } else {
                    with_files_elements.addClass('hidden');
                    without_files_elements.removeClass('hidden');
                }
            }

            if (updates["files"]) {
              updateFileList();
            }

        },

        /**
         * Render a file.
         *
         */
        renderFile: function (file) {
            var file_view = new FileItemWidget(
              $(langx.template(this.options.fileItem.template,file.get("data")))[0],
              {
                model: file,
                template : this.options.fileItem.template
            });
            //this._velm.$(this.options.selectors.fileList).append(file_view.render());
            file_view.render();
            file_view.attach(this._velm.$(this.options.selectors.fileList)[0]);
        },

        /**
         * Bind events on the upload processor.
         *
         */
        bindProcessEvents: function () {
        }
    });

    return filer.Uploader = Uploader;
});
