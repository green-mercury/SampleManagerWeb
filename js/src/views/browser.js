import $ from 'jquery';

class BrowserView {
  constructor(params) {
    this.params = params;

    this.queryDict = {};
  }

  onDocumentReady() {
    const self = this;

    // parse the query string and put it in a dictionary
    location.search.substr(1).split('&').
        forEach(function(item) {
          self.queryDict[item.split('=')[0]] = item.split('=')[1];
        });
    function dictToURI(dict) {
      const str = [];
      for (const p in dict) {
        str.push(encodeURIComponent(p) + '=' + encodeURIComponent(dict[p]));
      }
      return str.join('&');
    }

    if (this.queryDict['multi'] === 'true') {
      this.setMultiSelection();
    } else {
      this.setSingleSelection();
    }
  
    $('#multiswitch-checkbox').click(function(event) {
      if (this.checked) {
        self.setMultiSelection();
      } else {
        self.setSingleSelection();
      }
    });
  
    // tell the upload form how to communicate with the server
    $('#uploadform').submit(function(event) {
      event.preventDefault();
      const formData = new FormData(this);
  
      // show "activity" overlay
      $('#overlaytext').text('Uploading file...');
      $('#overlay').css('display', 'block');
      // send file to server
      $.ajax({
        url: '/browser/upload?type=img',
        data: formData,
        type: 'POST',
        contentType: false,
        processData: false,
        success: function(data) {
          if (data.uploaded) {
            parent.CKEDITOR.dialog.getCurrent().hide();	// hide the file browser
            parent.CKEDITOR.fbcallback(data.url); // call the call back
          } else {
            alert('Error: '+data.error['message']);
            $('#overlay').css('display', 'none');
          }
        },
        error: function(jqXHR, textStatus, errorThrown) {
          alert('Error when communicating with server.');
        },
      });
    });
  
    function folderclickhandler(event) {
      if (document.getElementById('multiswitch-checkbox') !== null) {
        self.queryDict['multi'] = document.getElementById('multiswitch-checkbox').checked;
      }
      location.replace('/browser/'+$(this).data('url')+'?'+dictToURI(self.queryDict));
      event.preventDefault();
    }
  
    $('.folder').click(folderclickhandler);
  
    // TODO: note that the functionality of inpectpath and inspectresource could be easily combined and the following
    // code could be reduced a lot by treating historyitem, resource and shortcut all the same way...
  
    // check for each history item if it is available
    $('.historyitem').each(function(index, element) {
      const historyitemdiv = $(this);
      $.ajax({
        url: '/browser/inspectpath',
        type: 'post',
        data: {'smbpath': $(this).data('url')},
        success: function(data) {
          if (!data.code) {
            historyitemdiv.find('img').attr('src', '/static/images/folder.png');
            historyitemdiv.addClass('available'); // for CSS :hover
            // add click handler for new elements
            historyitemdiv.click(folderclickhandler);
          } else {
            historyitemdiv.find('img').attr('src', '/static/images/folder_inaccessible.png');
          }
        },
      });
    });
  
    // check for each resource if it is available and if it has a user/sample folder
    $('.resource').each(function(index, element) {
      $.ajax({
        url: '/browser/inspectresource',
        type: 'post',
        data: {'sampleid': self.queryDict['sample'],
          'resourceid': $(this).data('id')},
        success: function(data) {
          const resourcediv = $('#resource' + data.resourceid);
          const shortcutsdiv = $('#shortcuts' + data.resourceid);
          shortcutsdiv.empty();
          if (!data.code) {
            if (data.userfolder != '') {
              shortcutsdiv.append('<img class=\'shortcut\' src=\'/static/images/user.png\' data-url=\''+data.userfolder+'\'>');
            }
            if (data.samplefolder != '') {
              shortcutsdiv.append('<img class=\'shortcut\' src=\'/static/images/sample.png\' data-url=\''+data.samplefolder+'\'>');
            }
            resourcediv.addClass('available'); // for CSS :hover
  
            // add click handler for new elements
            resourcediv.click(folderclickhandler);
            shortcutsdiv.children('img').click(folderclickhandler);
          } else {
            resourcediv.append(' (N/A)');
          }
        },
      });
    });
  }

  setSingleSelection() {
    const self = this;

    // disable Save button
    $('#savemulti').unbind('click');
    $('#savemulti').addClass('disabled');
  
    // unselect selected files
    $('.file.selected').removeClass('selected');
  
    // update handler for file tiles
    $('.file').unbind('click');
    $('.file').click(function(event) {
      const path = $(this).data('path');
      // show "activity" overlay
      $('#overlaytext').text('Saving file...');
      $('#overlay').css('display', 'block');
      // tell the server to store the file
      $.ajax({
        url: '/browser/savefromsmb',
        type: 'post',
        data: {'path': path,
          'type': self.queryDict['type']},
        success: function(data) {
          if (data.code) {
            alert('Error: '+data.message);
            $('#overlay').css('display', 'none');
          } else {
            // hide the file browser
            parent.CKEDITOR.dialog.getCurrent().hide();
            // call the call back function
            parent.CKEDITOR.fbcallback(data.uploadurl, {'filename': data.filename, 'type': data.type});
          }
        },
      });
    });
  }

  setMultiSelection() {
    const self = this;

    // update handler for file tiles
    $('.file').unbind('click');
    $('.file').click(function(event) {
      $(this).toggleClass('selected');
    });
  
    // set up Save button
    $('#savemulti').removeClass('disabled');
    $('#savemulti').click(function() {
      // count files
      files_total = $('.file.selected').length;
      files_left = files_total;
      // show "activity" overlay
      $('#overlaytext').html('Saving files... <span id="filecounter">(0/'+files_total+')</span>'+
              '<div id="saveerrors"></div>');
      $('#overlay').css('display', 'block');
      // save files
      $('.file.selected').each(function() {
        const path = $(this).data('path');
        // tell the server to store the file
        $.ajax({
          url: '/browser/savefromsmb',
          type: 'post',
          data: {'path': path,
            'type': self.queryDict['type']},
          success: function(data) {
            files_left -= 1;
            $('#filecounter').text('('+(files_total-files_left)+'/'+files_total+')');
            if (data.code) {
              $('#saveerrors').append('<div>Error: '+data.filename+': '+data.message+'</div>');
            } else {
              // call the call back function
              parent.CKEDITOR.fbcallback(data.uploadurl, {'filename': data.filename, 'type': data.type});
            }
            if (!files_left && $('#saveerrors').html() == '') {
              // hide the file browser
              parent.CKEDITOR.dialog.getCurrent().hide();
            }
          },
        });
      });
    });
  }
}

let files_total = 0;
let files_left = 0;

export default BrowserView;
