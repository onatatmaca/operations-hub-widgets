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
  var queryData = data.queryData;
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

  // Query Historian for REAL historical data
  var queryHistorianHistory = function(tagName, startTime, endTime, callback) {
    console.log('[BIOGAS] Attempting to query Historian for:', tagName);
    console.log('[BIOGAS] Time range:', startTime.toISOString(), 'to', endTime.toISOString());
    
    try {
      // Create historical query using dd-historian protocol
      // This attempts to query actual Historian data with time range
      var historicalQueryConfig = {
        type: 'query',
        dataSource: {
          type: 'dd-historian',
          server: 'Erfstadt Historian',
          tagNames: [tagName],
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          samplingMode: 'Interpolated',
          calculationMode: 'Average',
          intervalCount: 24 // 24 points for 24 hours
        }
      };
      
      // Try to execute the query
      if (typeof EMBED.executeQuery === 'function') {
        EMBED.executeQuery(historicalQueryConfig, function(result) {
          console.log('[BIOGAS] Historical query SUCCESS:', result);
          if (callback) callback(result);
        }, function(error) {
          console.log('[BIOGAS] Historical query FAILED:', error);
          if (callback) callback(null);
        });
      } else {
        console.log('[BIOGAS] EMBED.executeQuery not available, using simulated data');
        if (callback) callback(null);
      }
    } catch (error) {
      console.error('[BIOGAS] Error querying Historian:', error);
      if (callback) callback(null);
    }
  };

  // Parse Historian historical response
  var parseHistorianHistory = function(historianData) {
    if (!historianData || !historianData.rows || historianData.rows.length === 0) {
      console.log('[BIOGAS] No historical data in response');
      return null;
    }
    
    console.log('[BIOGAS] Parsing', historianData.rows.length, 'historical data points');
    
    var result = [];
    historianData.rows.forEach(function(row) {
      var timestamp = new Date(row.Timestamp || row.timestamp);
      var value = parseFloat(row.Value || row.value);
      
      if (!isNaN(value)) {
        result.push({
          time: timestamp,
          value: value
        });
      }
    });
    
    return result.sort(function(a, b) { return a.time - b.time; });
  };

  var drawChart = function(canvas, data, unit) {
    var ctx = canvas.getContext('2d');
    var width = canvas.width;
    var height = canvas.height;
    
    ctx.clearRect(0, 0, width, height);
    
    if (!data || data.length === 0) {
      ctx.fillStyle = '#666';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('No data available', width / 2, height / 2);
      return;
    }
    
    var values = data.map(function(d) { return d.value; });
    var minValue = Math.min.apply(null, values);
    var maxValue = Math.max.apply(null, values);
    var range = maxValue - minValue;
    if (range === 0) range = 1;
    
    var padding = 40;
    var chartHeight = height - padding - 20;
    var chartWidth = width - padding - 20;
    
    // Grid
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    for (var i = 0; i <= 4; i++) {
      var y = padding + (chartHeight / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - 10, y);
      ctx.stroke();
    }
    
    // Line
    ctx.strokeStyle = '#82dffe';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    
    for (var i = 0; i < data.length; i++) {
      var x = padding + (chartWidth / (data.length - 1)) * i;
      var y = padding + chartHeight - ((data[i].value - minValue) / range) * chartHeight;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
    
    // Points
    ctx.fillStyle = '#86f37a';
    for (var i = 0; i < data.length; i++) {
      var x = padding + (chartWidth / (data.length - 1)) * i;
      var y = padding + chartHeight - ((data[i].value - minValue) / range) * chartHeight;
      
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, 2 * Math.PI);
      ctx.fill();
    }
    
    // Labels
    ctx.fillStyle = '#e0e0e0';
    ctx.font = '10px Courier New';
    ctx.textAlign = 'right';
    ctx.fillText(maxValue.toFixed(1) + ' ' + unit, padding - 5, padding + 5);
    ctx.fillText(minValue.toFixed(1) + ' ' + unit, padding - 5, padding + chartHeight + 5);
    
    if (data.length > 0) {
      ctx.textAlign = 'center';
      var firstTime = data[0].time;
      var lastTime = data[data.length - 1].time;
      
      ctx.fillText(firstTime.getHours() + ':00', padding, height - 5);
      ctx.fillText(lastTime.getHours() + ':00', width - 10, height - 5);
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
    
    // Calculate time ranges
    var now = new Date();
    var twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    var sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    // Try to query REAL historical data from Historian
    queryHistorianHistory(tagName, twentyFourHoursAgo, now, function(historianResult) {
      var hourlyData = null;
      var dataSource = '(Simuliert)'; // Default to simulated
      
      if (historianResult) {
        hourlyData = parseHistorianHistory(historianResult);
        if (hourlyData && hourlyData.length > 0) {
          dataSource = '(Historian)';
          console.log('[BIOGAS] Using REAL Historian data:', hourlyData.length, 'points');
        }
      }
      
      // Fallback to simulated if no real data
      if (!hourlyData || hourlyData.length === 0) {
        console.log('[BIOGAS] Using simulated data as fallback');
        hourlyData = generate24HourData(currentValue);
        dataSource = '(Simuliert)';
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
      var chartTitle = locale === 'DE' ? 
        'Letzte 24 Stunden ' + dataSource : 
        'Last 24 Hours ' + dataSource;
      chartContainer.append('<div class="chart-title">' + chartTitle + '</div>');
      var canvas = $('<canvas class="chart-canvas" width="1400" height="400"></canvas>');
      chartContainer.append(canvas);
      
      historyContent.append(tableContainer);
      historyContent.append(chartContainer);
      
      drawChart(canvas[0], hourlyData, unit);
    });
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

  console.log('[BIOGAS] Plugin initialized successfully');
})();
