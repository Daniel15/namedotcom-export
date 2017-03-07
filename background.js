chrome.runtime.onMessage.addListener(function(result) {
  if (result.exportAsDataURI) {
    var dataURI = 'data:text/plain;base64,' + btoa(result.content);
    chrome.tabs.create({url: dataURI});
  }
});
