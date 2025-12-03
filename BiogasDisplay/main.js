(function () {
  "use strict";

  console.log('[BIOGAS] Plugin initializing...');

  var element = EMBED.getRootElement();
  var data = EMBED.getComponent().schema.data;

  var tagUnits = {
    'STAT6.111LME_A01_SCALE.F_CV': '%',
    'STAT6.111TME_A01_SCALE.F_CV': '°C',
    'STAT6.151PME_A05_SCALE.F_CV': '%',
    'STAT6.141PME_A04_SCALE.F_CV': '%',
    'STAT6.141PME_C01_SCALE.F_CV': 'bar',
    'STAT6.121PML_A02_SCALE.F_CV': 'bar',
    'STAT6.121TME_B01_SCALE.F_CV': '°C',
    'STAT6.131PME_A01_SCALE.F_CV': '%',
    'STAT6.131TME_C01_SCALE.F_CV': '°C',
    'STAT6.131TME_C02_SCALE.F_CV': '°C',
    'STAT6.132PME_A02_SCALE.F_CV': '%',
    'STAT6.132TME_C03_SCALE.F_CV': '°C',
    'STAT6.132TME_C04_SCALE.F_CV': '°C',
    'STAT6.133PME_A03_SCALE.F_CV': '%',
    'STAT6.133TME_C05_SCALE.F_CV': '°C',
    'STAT6.133TME_C06_SCALE.F_CV': '°C',
    'STAT6.141PCI_B01_HZIST_SCALE.F_CV': 'Hz',
    'STAT6.141PCI_B01_STROMIST_SCALE.F_CV': 'A',
    'STAT6.141PFD_C01_HZIST_SCALE.F_CV': 'Hz',
    'STAT6.141PFD_C01_STROMIST_SCALE.F_CV': 'A',
    'STAT6.141PFD_D01_HZIST_SCALE.F_CV': 'Hz',
    'STAT6.141PFD_D01_STROMIST_SCALE.F_CV': 'A',
    'STAT6.141COS_A01_HZIST_SCALE.F_CV': 'Hz',
    'STAT6.141COS_A01_STROMIST_SCALE.F_CV': 'A',
    'STAT6.121PFD_B01_HZIST_SCALE.F_CV': 'Hz',
    'STAT6.121PFD_B01_STROMIST_SCALE.F_CV': 'A',
    'STAT6.165PME_B01_SCALE.F_CV': '%',
    'STAT6.165TME_E01_SCALE.F_CV': '°C',
    'STAT6.166PME_B02_SCALE.F_CV': '%',
    'STAT6.166TME_E02_SCALE.F_CV': '°C',
    'STAT6.161PME_A06_SCALE.F_CV': '%',
    'STAT6.161TME_D01_SCALE.F_CV': '°C',
    'STAT6.162PME_A07_SCALE.F_CV': '%',
    'STAT6.162TME_D02_SCALE.F_CV': '°C',
    'STAT6.163PME_A08_SCALE.F_CV': '%',
    'STAT6.163TME_D03_SCALE.F_CV': '°C',
    'STAT6.164PME_A09_SCALE.F_CV': '%',
    'STAT6.164TME_D04_SCALE.F_CV': '°C',
    'STAT6.T_MENGE_DEKANTER_SCALE.F_CV': 'm³',
    'STAT6.T_MENGE_ABWASS_ROWATA_SCALE.F_CV': 'm³',
    'STAT6.T_MENGE_ABWASS_ABWATA_SCALE.F_CV': 'm³',
    'STAT6.T_MENGE_BRAUCHWASSER_SCALE.F_CV': 'm³',
    'STAT6.141FME_A01_SCALE.F_CV': 'm³/h',
    'STAT6.FLOW_BRAUCHWASSER_SCALE.F_CV': 'm³/h'
  };

  var tagsLoaded = 0;
  var currentValues = {};
  var historicalCache = {}; // Cache for historical data by tag name
  var queryData = data.queryData;
  var historicalData = data.historicalData;
  var locale = data.locale || 'DE'; // Default to German

  // Translations
  var translations = {
    DE: {
      dateLabel: 'Datum',
      avgLabel: 'Ø',
      last24Hours: 'Letzte 24 Stunden (Simuliert)',
      status: 'Status',
      updated: 'Aktualisiert',
      tags: 'Tags',
      connected: 'Verbunden',
      disconnected: 'Getrennt',
      generating: 'Historische Daten werden generiert...'
    },
    US: {
      dateLabel: 'Date',
      avgLabel: 'Avg',
      last24Hours: 'Last 24 Hours (Simulated)',
      status: 'Status',
      updated: 'Updated',
      tags: 'Tags',
      connected: 'Connected',
      disconnected: 'Disconnected',
      generating: 'Generating historical data...'
    },
    UK: {
      dateLabel: 'Date',
      avgLabel: 'Avg',
      last24Hours: 'Last 24 Hours (Simulated)',
      status: 'Status',
      updated: 'Updated',
      tags: 'Tags',
      connected: 'Connected',
      disconnected: 'Disconnected',
      generating: 'Generating historical data...'
    }
  };

  var t = translations[locale];

  // Format date according to locale
  var formatDate = function(date) {
    if (locale === 'DE') {
      return date.toLocaleDateString('de-DE');
    } else if (locale === 'US') {
      return date.toLocaleDateString('en-US');
    } else {
      return date.toLocaleDateString('en-GB');
    }
  };

  // Format time according to locale
  var formatTime = function(date) {
    if (locale === 'DE') {
      return date.toLocaleTimeString('de-DE');
    } else if (locale === 'US') {
      return date.toLocaleTimeString('en-US');
    } else {
      return date.toLocaleTimeString('en-GB');
    }
  };

  var updateTagValue = function(tagName, value, quality) {
    console.log('[BIOGAS] Updating tag:', tagName, '=', value);
    
    // Store as number for historical calculations
    if (typeof value === 'number') {
      currentValues[tagName] = value;
    } else {
      currentValues[tagName] = parseFloat(value);
    }
    
    var row = element.find('tr[data-tag="' + tagName + '"]');
    if (row.length === 0) {
      console.log('[BIOGAS] Row not found for tag:', tagName);
      return;
    }

    var valueCell = row.find('.value');
    var unit = tagUnits[tagName] || '';
    
    // CRITICAL: Ensure proper rounding to 1 decimal
    var numValue = typeof value === 'number' ? value : parseFloat(value);
    var formatted = isNaN(numValue) ? '--' : numValue.toFixed(1);

    valueCell.html(formatted + '<span class="unit">' + unit + '</span>');
    
    if (quality && quality !== 'Good' && quality !== 'good') {
      valueCell.addClass('offline');
    } else {
      valueCell.removeClass('offline');
    }
  };

  var updateStatus = function(count) {
    element.find('#tagCount').text(count + '/44');
    element.find('#updateTime').text(formatTime(new Date()));
    
    if (count > 0) {
      element.find('#statusDot').removeClass('offline');
      element.find('#statusText').text(t.connected);
    } else {
      element.find('#statusDot').addClass('offline');
      element.find('#statusText').text(t.disconnected);
    }
  };

  var generateDailyAverages = function(currentValue) {
    var data = [];
    var today = new Date();
    
    // Generate from oldest to newest
    for (var i = 7; i >= 1; i--) {
      var date = new Date(today);
      date.setDate(date.getDate() - i);
      
      var avg = currentValue * (0.9 + Math.random() * 0.2);
      
      data.push({
        date: formatDate(date),
        average: avg
      });
    }
    
    // Reverse so newest is first
    return data.reverse();
  };

  var generate24HourData = function(currentValue) {
    var data = [];
    var now = new Date();
    
    for (var i = 24; i >= 0; i--) {
      var time = new Date(now);
      time.setHours(time.getHours() - i);
      
      var value = currentValue * (0.85 + Math.random() * 0.3);
      
      data.push({
        time: time,
        value: value
      });
    }
    
    return data;
  };

  var drawChart = function(canvas, data, unit) {
    var ctx = canvas.getContext('2d');
    var width = canvas.width;
    var height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    if (!data || data.length === 0) {
      ctx.fillStyle = '#999';
      ctx.font = '16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('No data available', width / 2, height / 2);
      return;
    }

    // Calculate value range with 10% padding for better visibility
    var values = data.map(function(d) { return d.value; });
    var minValue = Math.min.apply(null, values);
    var maxValue = Math.max.apply(null, values);
    var range = maxValue - minValue;
    if (range === 0) range = 1;

    // Add 10% padding to min/max for better visualization
    var padding = range * 0.1;
    minValue = minValue - padding;
    maxValue = maxValue + padding;
    range = maxValue - minValue;

    // Chart dimensions with better padding
    var paddingLeft = 80;
    var paddingRight = 30;
    var paddingTop = 30;
    var paddingBottom = 50;
    var chartHeight = height - paddingTop - paddingBottom;
    var chartWidth = width - paddingLeft - paddingRight;

    // Draw horizontal grid lines (6 lines)
    ctx.strokeStyle = 'rgba(100, 100, 100, 0.3)';
    ctx.lineWidth = 1;
    for (var i = 0; i <= 5; i++) {
      var y = paddingTop + (chartHeight / 5) * i;
      ctx.beginPath();
      ctx.moveTo(paddingLeft, y);
      ctx.lineTo(paddingLeft + chartWidth, y);
      ctx.stroke();
    }

    // Draw Y-axis labels (values)
    ctx.fillStyle = '#e0e0e0';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (var i = 0; i <= 5; i++) {
      var value = maxValue - (range / 5) * i;
      var y = paddingTop + (chartHeight / 5) * i;
      ctx.fillText(value.toFixed(1) + ' ' + unit, paddingLeft - 10, y);
    }

    // Draw data line
    ctx.strokeStyle = '#82dffe';
    ctx.lineWidth = 3;
    ctx.beginPath();

    for (var i = 0; i < data.length; i++) {
      var x = paddingLeft + (chartWidth / (data.length - 1)) * i;
      var valueRatio = (data[i].value - minValue) / range;
      var y = paddingTop + chartHeight - (valueRatio * chartHeight);

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // Draw data points
    ctx.fillStyle = '#86f37a';
    for (var i = 0; i < data.length; i++) {
      var x = paddingLeft + (chartWidth / (data.length - 1)) * i;
      var valueRatio = (data[i].value - minValue) / range;
      var y = paddingTop + chartHeight - (valueRatio * chartHeight);

      ctx.beginPath();
      ctx.arc(x, y, 5, 0, 2 * Math.PI);
      ctx.fill();
    }

    // Draw X-axis labels (time)
    if (data.length > 0) {
      ctx.fillStyle = '#e0e0e0';
      ctx.font = 'bold 13px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      // Show labels every 4 hours or adjust based on data points
      var labelInterval = Math.max(1, Math.floor(data.length / 6));
      for (var i = 0; i < data.length; i += labelInterval) {
        var x = paddingLeft + (chartWidth / (data.length - 1)) * i;
        var time = data[i].time;
        var hours = time.getHours();
        var minutes = time.getMinutes();
        var timeStr = hours + ':' + (minutes < 10 ? '0' : '') + minutes;
        ctx.fillText(timeStr, x, paddingTop + chartHeight + 10);
      }

      // Always show last point
      if (data.length > 1) {
        var lastIdx = data.length - 1;
        var x = paddingLeft + chartWidth;
        var time = data[lastIdx].time;
        var hours = time.getHours();
        var minutes = time.getMinutes();
        var timeStr = hours + ':' + (minutes < 10 ? '0' : '') + minutes;
        ctx.fillText(timeStr, x, paddingTop + chartHeight + 10);
      }
    }
  };

  var showHistoricalData = function(tagName, row) {
    var currentValue = currentValues[tagName];
    var unit = tagUnits[tagName] || '';
    
    if (!currentValue || isNaN(currentValue)) {
      console.log('[BIOGAS] No current value for', tagName);
      return;
    }
    
    var historyRow = row.next('.history-row');
    
    if (historyRow.length > 0) {
      if (historyRow.hasClass('visible')) {
        historyRow.removeClass('visible');
        row.removeClass('expanded');
      } else {
        historyRow.addClass('visible');
        row.addClass('expanded');
      }
      return;
    }
    
    historyRow = $('<tr class="history-row visible"></tr>');
    var historyCell = $('<td colspan="4"></td>');
    var historyContent = $('<div class="history-content"></div>');
    
    var loadingDiv = $('<div class="loading-indicator">' + t.generating + '</div>');
    historyContent.append(loadingDiv);
    
    historyCell.append(historyContent);
    historyRow.append(historyCell);
    row.after(historyRow);
    row.addClass('expanded');
    
    // Check if we have real historical data in cache
    var hourlyData = null;

    if (historicalCache[tagName] && historicalCache[tagName].length > 0) {
      hourlyData = historicalCache[tagName];
      console.log('[BIOGAS] Using REAL Historian data from cache:', hourlyData.length, 'points');
    } else {
      console.log('[BIOGAS] No historical data in cache, using simulated data');
      hourlyData = generate24HourData(currentValue);
    }

    // Generate daily averages (for now still simulated - would need separate daily query)
    var dailyData = generateDailyAverages(currentValue);

    // Build UI
    historyContent.empty();

    var tableContainer = $('<div class="history-table-container"></div>');
    var tableHTML = '<table class="history-table">' +
      '<thead><tr><th>' + t.dateLabel + '</th><th>' + t.avgLabel + ' ' + unit + '</th></tr></thead>' +
      '<tbody>';

    for (var i = 0; i < dailyData.length; i++) {
      tableHTML += '<tr>' +
        '<td>' + dailyData[i].date + '</td>' +
        '<td>' + dailyData[i].average.toFixed(1) + '</td>' +
        '</tr>';
    }

    tableHTML += '</tbody></table>';
    tableContainer.html(tableHTML);

    var chartContainer = $('<div class="history-chart-container"></div>');
    var chartTitle = locale === 'DE' ? 'Letzte 24 Stunden' : 'Last 24 Hours';
    chartContainer.append('<div class="chart-title">' + chartTitle + '</div>');
    var canvas = $('<canvas class="chart-canvas" width="1400" height="400"></canvas>');
    chartContainer.append(canvas);

    historyContent.append(tableContainer);
    historyContent.append(chartContainer);

    drawChart(canvas[0], hourlyData, unit);
  };

  var addClickHandlers = function() {
    element.find('tr[data-tag]').off('click').on('click', function() {
      var tagName = $(this).attr('data-tag');
      showHistoricalData(tagName, $(this));
    });
  };

  // Initialize UI labels based on locale
  var initializeLabels = function() {
    element.find('#statusTextLabel').text(t.status + ':');
    element.find('#updateTimeLabel').text(t.updated + ':');
    element.find('#tagCountLabel').text(t.tags + ':');
    element.find('#statusText').text(t.disconnected);
  };

  var processQueryData = function(rows) {
    console.log('[BIOGAS] Processing query data, rows:', rows.length);
    
    tagsLoaded = 0;

    rows.forEach(function(row) {
      var tagName = row.Name || row.name;
      var value = row.Value || row.value;
      var quality = row.Quality || row.quality;

      if (tagName && value !== undefined && value !== null) {
        updateTagValue(tagName, value, quality);
        tagsLoaded++;
      }
    });

    updateStatus(tagsLoaded);
    console.log('[BIOGAS] Updated', tagsLoaded, 'tags');
    
    addClickHandlers();
  };

  console.log('[BIOGAS] Query data type:', queryData.type);

  // Initialize UI labels
  initializeLabels();

  if (EMBED.fieldTypeIsQuery(queryData)) {
    console.log('[BIOGAS] Query mode - subscribing to changes');

    EMBED.subscribeFieldToQueryChange(queryData, function(rows) {
      console.log('[BIOGAS] Query data received!');
      processQueryData(rows);
    });

    console.log('[BIOGAS] Subscription active');
  }

  // Subscribe to historical data if available
  if (historicalData && EMBED.fieldTypeIsQuery(historicalData)) {
    console.log('[BIOGAS] Historical data query detected - subscribing');

    EMBED.subscribeFieldToQueryChange(historicalData, function(rows) {
      console.log('[BIOGAS] Historical data received:', rows.length, 'rows');

      // Clear previous cache
      historicalCache = {};

      // Organize historical data by tag name
      rows.forEach(function(row) {
        var tagName = row.Name || row.name;
        var value = row.Value || row.value;
        var timestamp = row.Timestamp || row.timestamp;

        if (tagName && value !== undefined && value !== null && timestamp) {
          if (!historicalCache[tagName]) {
            historicalCache[tagName] = [];
          }

          historicalCache[tagName].push({
            time: new Date(timestamp),
            value: parseFloat(value)
          });
        }
      });

      // Sort each tag's historical data by time
      for (var tagName in historicalCache) {
        historicalCache[tagName].sort(function(a, b) {
          return a.time - b.time;
        });
      }

      console.log('[BIOGAS] Historical cache built for', Object.keys(historicalCache).length, 'tags');
    });

    console.log('[BIOGAS] Historical data subscription active');
  } else {
    console.log('[BIOGAS] No historical data query configured - will use simulated data');
  }

  console.log('[BIOGAS] Plugin initialized successfully');
})();
