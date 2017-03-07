(function() {
  function init() {
    var buttonArea = document.querySelector('#dns-tab-content .btn-group');
    if (!buttonArea) {
      console.error('Template button not found!');
      return;
    }

    var exportButton = document.createElement('button');
    exportButton.type = 'button';
    exportButton.className = 'btn btn-primary';
    exportButton.style.marginLeft = '8px';
    exportButton.appendChild(document.createTextNode('Export DNS Zone'));
    exportButton.addEventListener('click', runExport, false);
    buttonArea.appendChild(exportButton);
  }

  function getCurrentDomain() {
    var pathParts = document.location.pathname.split('/');
    var domain = pathParts[pathParts.length - 1];
    if (domain === '') {
      domain = pathParts[pathParts.length - 2];
    }

    // Sanity check - Ensure the resulting string at least *looks* like a domain
    if (domain.indexOf('.') === -1) {
      alert('Unable to determine current domain');
      return null;
    }
    return domain;
  }

  function loadZone(domain, cb) {
    var csrfToken = document.querySelector('meta[name="csrf-token"]').content;
    var xhr = new XMLHttpRequest();
    xhr.onload = function() {
      var response = JSON.parse(xhr.responseText);
      if (response.success === 0) {
        alert('Error while loading DNS zone: ' + response.message);
        return;
      }
      cb(response);
    };
    xhr.open('GET', '/api/v3/domain/' + domain + '/dns', true);
    xhr.setRequestHeader('x-csrf-token-auth', csrfToken);
    xhr.send(null);
  }

  function generateSerial(entries) {
    var latestDate = '';
    entries.forEach(function(entry) {
      // "2017-03-06 01:23:00" -> "20170306"
      var createDate = entry.create_date.split(' ')[0].replace(/-/g, '');
      if (createDate > latestDate) {
        latestDate = createDate;
      }
    });
    return latestDate + '01';
  }

  function formatZoneAsBIND(domain, entries) {
    // SOA record returned by Name.com API is invalid, so omit it
    entries = entries.filter(function(entry) { return entry.type !== 'SOA' });

    entries.sort(function(a, b) {
      // Sort by name, then by type
      var diff = a.name.localeCompare(b.name);
      return diff !== 0 ? diff : a.type.localeCompare(b.type);
    });

    var output = [
      ';; Domain: ' + domain,
      ';; Exported using Name.com DNS Export: http://dl.vc/namedotcom-export',
      '',
      [
        '@',
        '3600', // TTL
        'IN',
        'SOA',
        'ns1.name.com.', // Authoritive DNS server
        'webmaster.' + domain + '.', // Email
        generateSerial(entries),
        7200, // Refresh
        3600, // Retry
        86400, // Expire
        3600 // Minimum
      ].join('\t')
    ].concat(
      entries.map(function(entry) { return formatEntry(entry); })
    );
    return output.join('\n');
  }

  function formatEntry(entry) {
    var content = entry.content;
    // Append dot to content if needed
    if (
      (entry.type !== 'A' && entry.type !== 'AAAA' && entry.type !== 'TXT') &&
      content.charAt(content.length - 1) !== '.'
    ) {
      content += '.';
    }
    // Prepend priority if needed
    if (entry.type === 'MX' || entry.type === 'SRV') {
      content = entry.prio + '\t' + content;
    }

    return [
      entry.name + '.',
      entry.ttl,
      'IN',
      entry.type,
      content,
    ].join('\t');
  }

  function runExport(e) {
    e.preventDefault();
    var domain = getCurrentDomain();
    if (!domain) {
      return;
    }
    loadZone(domain, function(zone) {
      var formatted = formatZoneAsBIND(domain, zone);
      chrome.runtime.sendMessage({
        exportAsDataURI: true,
        content: formatted,
      });
    });
  }

  init();
}());
