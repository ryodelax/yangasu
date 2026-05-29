const BUDGET_APP = {
  propertyKey: 'BUDGET_APP_SPREADSHEET_ID',
  spreadsheetName: 'Budget Orbit Data',
  timezone: 'Asia/Tokyo',
  sheets: {
    categories: 'BudgetCategories',
    incomeTargets: 'IncomeTargets',
    transactions: 'Transactions'
  },
  headers: {
    categories: ['id', 'name', 'budget', 'updated_at'],
    incomeTargets: ['id', 'name', 'target', 'updated_at'],
    transactions: ['id', 'date', 'type', 'category', 'amount', 'note', 'updated_at']
  }
};

function isBudgetAppRequest_(e) {
  return !!(e && e.parameter && e.parameter.app === 'budget');
}

function renderBudgetApp_() {
  ensureBudgetAppSpreadsheet_();

  const template = HtmlService.createTemplateFromFile('budget_webapp');
  template.bootstrap = JSON.stringify(getBudgetAppPayload_());
  template.css = getBudgetPartialContent_('budget_webapp_css', 'style');
  template.js = getBudgetPartialContent_('budget_webapp_js', 'script');

  return template.evaluate()
    .setTitle('Budget Orbit')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function includeBudgetFile_(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getBudgetAppPayload() {
  return getBudgetAppPayload_();
}

function saveBudgetAppPayload(payload) {
  const sanitized = sanitizeBudgetPayload_(payload);
  const ss = ensureBudgetAppSpreadsheet_();

  replaceSheetValues_(
    ss.getSheetByName(BUDGET_APP.sheets.categories),
    BUDGET_APP.headers.categories,
    sanitized.categories.map(function(item) {
      return [item.id, item.name, item.budget, new Date()];
    })
  );

  replaceSheetValues_(
    ss.getSheetByName(BUDGET_APP.sheets.incomeTargets),
    BUDGET_APP.headers.incomeTargets,
    sanitized.incomeTargets.map(function(item) {
      return [item.id, item.name, item.target, new Date()];
    })
  );

  replaceSheetValues_(
    ss.getSheetByName(BUDGET_APP.sheets.transactions),
    BUDGET_APP.headers.transactions,
    sanitized.transactions.map(function(item) {
      return [item.id, item.date, item.type, item.category, item.amount, item.note, new Date()];
    })
  );

  return getBudgetAppPayload_();
}

function getBudgetAppSpreadsheetUrl() {
  return ensureBudgetAppSpreadsheet_().getUrl();
}

function setupBudgetApp() {
  const ss = ensureBudgetAppSpreadsheet_();
  return {
    ok: true,
    spreadsheetId: ss.getId(),
    spreadsheetUrl: ss.getUrl()
  };
}

function getBudgetAppUsageHint() {
  return 'WebアプリURLの末尾に ?app=budget を付けて開いてください。例: .../exec?app=budget';
}

function debugBudgetAppRender() {
  const template = HtmlService.createTemplateFromFile('budget_webapp');
  template.bootstrap = JSON.stringify(getBudgetAppPayload_());
  template.css = getBudgetPartialContent_('budget_webapp_css', 'style');
  template.js = getBudgetPartialContent_('budget_webapp_js', 'script');
  const html = template.evaluate().getContent();
  return {
    ok: true,
    length: html.length,
    head: html.slice(0, 800)
  };
}

function getBudgetPartialContent_(filename, tagName) {
  const html = HtmlService.createHtmlOutputFromFile(filename).getContent();
  const openTagPattern = new RegExp('^\\s*<' + tagName + '[^>]*>');
  const closeTagPattern = new RegExp('<\\/' + tagName + '>\\s*$');
  return html.replace(openTagPattern, '').replace(closeTagPattern, '').trim();
}

function ensureBudgetAppSpreadsheet_() {
  const props = PropertiesService.getScriptProperties();
  const existingId = props.getProperty(BUDGET_APP.propertyKey);
  let ss = null;

  if (existingId) {
    try {
      ss = SpreadsheetApp.openById(existingId);
    } catch (error) {
      ss = null;
    }
  }

  if (!ss) {
    ss = SpreadsheetApp.create(BUDGET_APP.spreadsheetName);
    props.setProperty(BUDGET_APP.propertyKey, ss.getId());
  }

  getOrCreateBudgetSheet_(ss, BUDGET_APP.sheets.categories, BUDGET_APP.headers.categories);
  getOrCreateBudgetSheet_(ss, BUDGET_APP.sheets.incomeTargets, BUDGET_APP.headers.incomeTargets);
  getOrCreateBudgetSheet_(ss, BUDGET_APP.sheets.transactions, BUDGET_APP.headers.transactions);

  return ss;
}

function getOrCreateBudgetSheet_(ss, sheetName, headers) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  const currentHeaders = headerRange.getValues()[0];
  if (headers.join('\t') !== currentHeaders.join('\t')) {
    headerRange.setValues([headers]);
    headerRange.setFontWeight('bold');
    sheet.setFrozenRows(1);
    if (sheet.getMaxColumns() > headers.length) {
      sheet.hideColumns(headers.length + 1, sheet.getMaxColumns() - headers.length);
    }
  }

  return sheet;
}

function getBudgetAppPayload_() {
  const ss = ensureBudgetAppSpreadsheet_();
  const categories = readBudgetSheetObjects_(ss.getSheetByName(BUDGET_APP.sheets.categories));
  const incomeTargets = readBudgetSheetObjects_(ss.getSheetByName(BUDGET_APP.sheets.incomeTargets));
  const transactions = readBudgetSheetObjects_(ss.getSheetByName(BUDGET_APP.sheets.transactions));

  return {
    selectedMonth: Utilities.formatDate(new Date(), BUDGET_APP.timezone, 'yyyy-MM'),
    spreadsheetUrl: ss.getUrl(),
    categories: categories.length ? categories.map(function(item) {
      return { id: String(item.id), name: String(item.name), budget: Number(item.budget) || 0 };
    }) : getDefaultBudgetCategories_(),
    incomeTargets: incomeTargets.length ? incomeTargets.map(function(item) {
      return { id: String(item.id), name: String(item.name), target: Number(item.target) || 0 };
    }) : getDefaultIncomeTargets_(),
    transactions: transactions.map(function(item) {
      return {
        id: String(item.id),
        date: normalizeBudgetDate_(item.date),
        type: item.type === 'income' ? 'income' : 'expense',
        category: String(item.category || ''),
        amount: Number(item.amount) || 0,
        note: String(item.note || '')
      };
    }).filter(function(item) {
      return item.id && item.date && item.category;
    })
  };
}

function readBudgetSheetObjects_(sheet) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];

  const values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  const headers = values[0].map(function(header) { return String(header || '').trim(); });

  return values.slice(1).filter(function(row) {
    return row.some(function(cell) { return cell !== '' && cell !== null; });
  }).map(function(row) {
    const obj = {};
    headers.forEach(function(header, index) {
      obj[header] = row[index];
    });
    return obj;
  });
}

function replaceSheetValues_(sheet, headers, rows) {
  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
  sheet.setFrozenRows(1);

  if (rows.length) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }

  sheet.autoResizeColumns(1, headers.length);
}

function sanitizeBudgetPayload_(payload) {
  const source = payload && typeof payload === 'object' ? payload : {};

  return {
    categories: sanitizeBudgetItems_(source.categories, 'budget'),
    incomeTargets: sanitizeBudgetItems_(source.incomeTargets, 'target'),
    transactions: sanitizeBudgetTransactions_(source.transactions)
  };
}

function sanitizeBudgetItems_(items, amountKey) {
  if (!Array.isArray(items)) return [];

  return items.map(function(item) {
    return {
      id: String(item && item.id || createBudgetId_()).trim(),
      name: String(item && item.name || '').trim(),
      budget: amountKey === 'budget' ? normalizeBudgetNumber_(item && item.budget) : undefined,
      target: amountKey === 'target' ? normalizeBudgetNumber_(item && item.target) : undefined
    };
  }).filter(function(item) {
    return item.name;
  }).map(function(item) {
    return amountKey === 'budget'
      ? { id: item.id, name: item.name, budget: item.budget }
      : { id: item.id, name: item.name, target: item.target };
  });
}

function sanitizeBudgetTransactions_(items) {
  if (!Array.isArray(items)) return [];

  return items.map(function(item) {
    const type = item && item.type === 'income' ? 'income' : 'expense';
    return {
      id: String(item && item.id || createBudgetId_()).trim(),
      date: normalizeBudgetDate_(item && item.date),
      type: type,
      category: String(item && item.category || '').trim(),
      amount: normalizeBudgetNumber_(item && item.amount),
      note: String(item && item.note || '').trim()
    };
  }).filter(function(item) {
    return item.id && item.date && item.category;
  });
}

function normalizeBudgetDate_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value)) {
    return Utilities.formatDate(value, BUDGET_APP.timezone, 'yyyy-MM-dd');
  }
  return String(value || '').trim().slice(0, 10);
}

function normalizeBudgetNumber_(value) {
  const num = Number(value);
  return isFinite(num) ? Math.max(0, Math.round(num)) : 0;
}

function createBudgetId_() {
  return Utilities.getUuid();
}

function getDefaultBudgetCategories_() {
  return [
    { id: createBudgetId_(), name: '住居', budget: 80000 },
    { id: createBudgetId_(), name: '食費', budget: 40000 },
    { id: createBudgetId_(), name: '通信', budget: 12000 },
    { id: createBudgetId_(), name: '移動', budget: 15000 },
    { id: createBudgetId_(), name: '交際', budget: 20000 },
    { id: createBudgetId_(), name: '投資・貯蓄', budget: 50000 }
  ];
}

function getDefaultIncomeTargets_() {
  return [
    { id: createBudgetId_(), name: '本業', target: 300000 },
    { id: createBudgetId_(), name: '副業', target: 80000 }
  ];
}
