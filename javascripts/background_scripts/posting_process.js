/**
 * @fileOverview This file provides for posting new links generated by the
 * extension to a host page.
 *
 * Posting Process:
 *
 * 1. The user selects an editable element with a right click
 * 2. The user clicks a Privly posting application in the resultant context
 *    menu.
 * 3. This script records the host page the link will be posted to
 * 4. The script opens a posting window and records its ID
 * 5. The posting application will complete and send this script 
 *    a message with the Privly URL
 * 6. The script sends the host page's content script,
 *    post_new_link.js, the URL
 */

/**
 * Handles right click on form event by opening posting window.
 *
 * @param {OnClickData} info Information on the context menu generating
 * this event.
 * @param {tab} sourceTab The tab that was clicked for the context menu
 * @param {string} postingApplicationPath the path of the posting application.
 * for examples, see the creation of the context menus.
 *
 */
function postingHandler(info, sourceTab, postingApplicationPath) {
  
  // only open a new posting window
  if (postingApplicationTabId === undefined) {
    
    var postingDomain = localStorage["posting_content_server_url"];
    if ( postingDomain === undefined ) {
      postingDomain = "https://privlyalpha.org";
    }

    var postingApplicationUrl = postingDomain + postingApplicationPath;
    
    postingApplicationStartingValue = info.selectionText;
    
    // Open a new window.
    chrome.windows.create({url: postingApplicationUrl, focused: true, 
                           width: 1100, height: 350,
                           top: 0, left: 0, type: "popup"}, 
      function(newWindow){
      
        //Get the window's tab
        var tab = newWindow.tabs[0];
      
        //remember the posting tab id
        postingApplicationTabId = tab.id;
      
        //remember the tab id where the post will be placed. The content script
        //will remember which form element was clicked
        postingResultTab = sourceTab;
      
        //tell the host page not to change the posting location on subsequent
        //right click events
        chrome.tabs.sendMessage(postingResultTab.id, {pendingPost: true});
      }
    );
  } else {
    
    // Notify users that they can't post twice at once
    var notification = webkitNotifications.createNotification(
      '../../images/logo_48.png',  // icon url - can be relative
      'Privly Warning',  // notification title
      'Close the posting window or finish the post before starting a new post.'  // notification body text
    );
    notification.show();
  }
};

/**
 * Handles the receipt of Privly URLs from the posting application 
 * for addition to the host page.
 *
 * @param {object} request The request object's JSON document. 
 * The request object should contain the privlyUrl.
 * @param {object} sender Information on the sending posting application
 * @param {function} sendResponse The callback function for replying to message
 *
 * @return {null} The function does not return anything, but it does call the
 * response function.
 */
function receiveNewPrivlyUrl(request, sender, sendResponse) {
  
  //
  if (request.privlyUrl !== undefined && postingResultTab !== undefined) {
    
    //Switches current tab to the page receiving the URL
    chrome.tabs.update(postingResultTab.id, {selected: true});
    
    //sends URL to host page
    chrome.tabs.sendMessage(postingResultTab.id, {privlyUrl: request.privlyUrl, pendingPost: false});
    
    //close the posting application
    chrome.tabs.remove(sender.tab.id);
    postingApplicationTabId = undefined;
    
    //remove the record of where we are posting to
    postingResultTab = undefined;
    
  } else if (request.messageSecret !== undefined && sender.tab.id === postingApplicationTabId) {
    
    //sends starting value to host page
    if( postingApplicationStartingValue !== undefined && 
      postingApplicationStartingValue !== "" ) {
        sendResponse({hostPageString: request.messageSecret + "InitialContent" + 
                      postingApplicationStartingValue});
    }
  }
}

/** 
 * Handle closure of posting application tabs. If the posting application 
 * or host page closes, the state should reset. The posting form will close 
 * as well.
 *
 * @param {integer} tabId The ID of the tab removed.
 * @param {removeInfo} removeInfo Information on the removal.
 *
 */
function tabRemoved(tabId, removeInfo) {

  if (postingResultTab === undefined || postingApplicationTabId === undefined) {
    return;
  }

  // The tab generating the URL closed
  if (tabId === postingApplicationTabId) {
    chrome.tabs.sendMessage(postingResultTab.id, {pendingPost: false});
    postingResultTab = undefined;
    postingApplicationTabId = undefined;
    postingApplicationStartingValue = "";
  } else if (tabId === postingResultTab.id) {
    // The tab receiving the URL Closed
    chrome.tabs.remove(postingApplicationTabId);
    postingResultTab = undefined;
    postingApplicationTabId = undefined;
    postingApplicationStartingValue = "";
  }
}

// Remembers where the PrivlyUrl will be placed based on the context menu
var postingResultTab = undefined;
var postingApplicationTabId = undefined;
var postingApplicationStartingValue = "";

// Informs the user that they must have a developer account to post new content
chrome.contextMenus.create({
    "title": "Privly is in Alpha. Do not assume your privacy.",
    "contexts": ["editable"],
    "enabled": false
  });

// Creates the ZeroBin context menu
chrome.contextMenus.create({
    "title": "Post with ZeroBin",
    "contexts": ["editable"],
    "onclick" : function(info, tab) {
        postingHandler(info, tab, "/zero_bin/");
    }
  });
  
// Creates the PlainPost context menu
chrome.contextMenus.create({
    "title": "Post with PlainPost",
    "contexts": ["editable"],
    "onclick" : function(info, tab) {
        postingHandler(info, tab, "/posts/plain_post");
    }
  });

// Handles the receipt of Privly URLs for addition to the web page.
// The request object should contain the privlyUrl.
chrome.extension.onMessage.addListener(receiveNewPrivlyUrl);

// Handle closure of posting application tabs
chrome.tabs.onRemoved.addListener(tabRemoved);
