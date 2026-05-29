const VEHICLE_SALES_APP = {
  propertyKey: 'VEHICLE_SALES_APP_SPREADSHEET_ID',
  spreadsheetName: 'Vehicle Sales Control',
  timezone: 'Asia/Tokyo',
  appParam: 'vehicle-sales',
  calendarDetailSlots: 3,
  sheets: {
    guide: '99_操作メモ',
    progressBoard: '01_案件進捗',
    calendar: '02_キャッシュフロー',
    dealSummary: '03_利益一覧',
    ownershipBoard: '04_所有権・在庫',
    cashoutExport: '05_支払い詳細',
    cashouts: '06_資金移動',
    dealLedger: '91_非表示_案件履歴',
    deals: '92_非表示_案件基本',
    recognitions: '94_非表示_利益計上',
    progressLogs: '95_非表示_進行記録'
  },
  legacySheets: {
    guide: ['操作ガイド', '見る順ガイド', '00_見る順ガイド', '00_最初に見る'],
    calendar: ['資金繰りカレンダー', '01_資金繰りカレンダー', '01_資金繰り', '01_見る_資金繰り'],
    dealSummary: ['案件サマリ', '02_案件サマリ', '02_案件一覧', '02_見る_案件一覧'],
    ownershipBoard: ['所有権・所在一覧', '03_所有権・所在一覧', '03_所有権と保管', '03_見る_所有権と保管'],
    cashoutExport: ['出金予定表', '03_出金予定表', '04_出金予定表', '04_支払予定', '04_見る_支払予定'],
    dealLedger: ['案件別台帳', '04_案件別台帳', '05_案件別台帳', '05_案件履歴', '05_見る_案件履歴'],
    progressBoard: ['進行ボード', '06_進行ボード', '06_見る_進行ボード'],
    deals: ['案件マスタ', '10_案件マスタ', '90_入力_案件', '90_入力_案件基本'],
    cashouts: ['資金移動', '11_資金移動', '91_入力_資金移動'],
    recognitions: ['収益計上', '12_収益計上', '92_入力_収益計上'],
    progressLogs: ['進行記録', '13_進行記録', '93_入力_進行記録']
  },
  sheetOrder: ['guide', 'progressBoard', 'calendar', 'dealSummary', 'ownershipBoard', 'cashoutExport', 'cashouts', 'dealLedger', 'deals', 'recognitions', 'progressLogs'],
  visibleSheetKeys: ['progressBoard', 'calendar', 'dealSummary', 'ownershipBoard', 'cashoutExport', 'cashouts'],
  sheetColors: {
    guide: '#315f72',
    progressBoard: '#425b8c',
    calendar: '#8e5b2d',
    dealSummary: '#2d6a6a',
    ownershipBoard: '#3f6b4f',
    cashoutExport: '#8e2f22',
    dealLedger: '#5b4f96',
    deals: '#6b7280',
    cashouts: '#6b7280',
    recognitions: '#6b7280',
    progressLogs: '#6b7280'
  },
  headers: {
    deals: [
      'id',
      '案件番号',
      '案件名',
      'ブランド',
      '車種',
      '車両管理キー',
      '仕入元区分',
      '仕入元名',
      '現在所有者区分',
      '現在所有者名',
      '保管先区分',
      '保管先名',
      '売却先区分',
      '売却先名',
      '所有権スキーム',
      'コンクエスト精算方式',
      '案件区分',
      '進捗',
      '在庫状態',
      '利益計上ルール',
      '残債精算あり',
      '案件発生日',
      '受注日',
      '登録予定日',
      '登録決定日',
      '販売売上税込',
      '販売売上税抜',
      '粗利見込',
      '粗利確定',
      '紹介料売上',
      '紹介料利益',
      '関連案件',
      'メモ',
      'updated_at'
    ],
    cashouts: [
      'id',
      'deal_id',
      '発生日',
      '資金区分',
      '入出金',
      '車両',
      '案件',
      '相手先区分',
      '相手先名',
      '査定額',
      '仕入額',
      '残債額',
      '残債等支払額',
      '資金移動額',
      '予定日',
      '資金レイヤー',
      '収益対象',
      '利益対象',
      '関連案件',
      '進行状況',
      'メモ',
      'updated_at'
    ],
    recognitions: [
      'id',
      'deal_id',
      '計上日',
      '計上種別',
      '売上区分',
      '売上金額税抜',
      '利益金額税抜',
      '確定条件',
      '連携先',
      'メモ',
      'updated_at'
    ],
    progressLogs: [
      'id',
      'deal_id',
      '記録日',
      '記録区分',
      '工程区分',
      '相手先区分',
      '相手先名',
      '内容',
      '次回予定日',
      '次回予定',
      '完了状況',
      '案件進捗更新',
      '在庫状態更新',
      'メモ',
      'updated_at'
    ],
    progressBoard: [
      '案件番号',
      '案件',
      'お客様',
      'ブランド',
      '車種',
      '車両管理キー',
      '現在進捗',
      '在庫状態',
      '最新やり取り日',
      '最新やり取り',
      '次回予定日',
      '次回予定',
      '未完了件数',
      '未完了内容',
      '資金差引',
      '残債返済予定額',
      'メモ'
    ],
    ownershipBoard: [
      '案件番号',
      '案件名',
      'ブランド',
      '車種',
      '車両管理キー',
      '仕入先',
      '現在所有権',
      '保管先',
      '売却先',
      '所有権スキーム',
      'コンクエスト精算',
      '進捗',
      'メモ'
    ],
    cashoutExport: [
      '支払希望日',
      '案件ID',
      '案件番号',
      '車両管理キー',
      '案件',
      '車両',
      '売却先',
      '現在所有権',
      '資金区分',
      '資金レイヤー',
      '支払先区分',
      '支払先',
      '資金移動額',
      '査定額',
      '仕入額',
      '残債額',
      '残債等支払額',
      '進行状況',
      '収益対象',
      '利益対象',
      '関連案件',
      'メモ'
    ],
    dealSummary: [
      '案件番号',
      '案件名',
      '車両',
      '車両管理キー',
      'お客様',
      '利益の種類',
      '確定売上（税込）',
      '確定利益税抜',
      '利益内訳',
      '差引資金',
      '現在進捗',
      '関係先',
      'メモ'
    ],
    dealLedger: [
      '案件ID',
      '案件番号',
      '案件名',
      '車種',
      '車両管理キー',
      '現在所有権',
      '保管先',
      '進捗',
      '行種別',
      '基準日',
      '予定日/計上日',
      '資金レイヤー',
      '入出金',
      '内容',
      '相手先',
      '資金移動額',
      '売上税抜',
      '利益税抜',
      '収益対象',
      '利益対象',
      '関連案件',
      'メモ'
    ]
  },
  defaults: {
    brands: ['JLR新車', 'JLR中古車', 'Maserati', '他社＆業販'],
    sourceTypes: ['顧客下取', '顧客買取', 'コンクエスト仕入', '業者買取', '自社在庫', 'その他'],
    ownerTypes: ['顧客', 'BRIDGE', 'コンクエスト', '業者', 'その他'],
    custodyTypes: ['BRIDGE', 'コンクエスト', '顧客', '業者', '外部保管', 'その他'],
    buyerTypes: ['個人客', '法人客', '業販', 'コンクエスト', '未定', 'その他'],
    ownershipSchemes: ['通常', '顧客買取→コンクエスト名義', 'コンクエスト紹介', '自社在庫', '業者仕入', 'その他'],
    settlementModes: ['なし', '月末相殺', '都度精算'],
    dealTypes: ['通常販売', '下取', '買取', '在庫販売', '業販', '紹介', 'その他'],
    progress: ['査定中', '仕入交渉中', '在庫', '商談中', '受注', '登録待ち', '納車済', '精算中', '完了', '延期', '敗戦'],
    inventoryStages: ['仕入前', '仕入予定', '在庫', '売約', '納車済', '精算中', '完了'],
    recognitionRules: ['通常', '登録時確定', '入金時確定', '紹介料売上=利益', '案件別判定'],
    loanFlags: ['なし', 'あり'],
    activityKinds: ['やり取り', 'ToDo', '完了記録'],
    activityPhases: ['初回接触', '査定', '下取査定', '下取支払', '新車提案', '受注', '入金確認', '新車発注', '登録準備', '納車前整備', '納車', '精算', 'その他'],
    activityStatuses: ['未着手', '進行中', '完了', '保留'],
    flowTypes: ['顧客買取支払', '仕入支払', '残債一括返済', '差額精算', '売上入金', '紹介料入金', 'コンクエスト相殺回収', 'コンクエスト相殺支払', '諸費用支払', 'その他'],
    flowDirections: ['出金', '入金'],
    counterpartyTypes: ['顧客', 'ローン会社', '業者', 'コンクエスト', '自社', 'その他'],
    moneyLanes: ['顧客向け', 'コンクエスト向け', 'ローン会社向け', '業者向け', '売上回収', '紹介料', 'その他'],
    targetFlags: ['対象外', '対象'],
    recognitionTypes: ['車両売上', '粗利確定', '紹介料', '値引調整', 'その他'],
    salesTypes: ['本体売上', '紹介料売上', 'その他売上']
  }
};

function isVehicleSalesAppRequest_(e) {
  return !!(e && e.parameter && e.parameter.app === VEHICLE_SALES_APP.appParam);
}

function renderVehicleSalesApp_(e) {
  const ss = ensureVehicleSalesAppSpreadsheet_();
  if (e && e.parameter && e.parameter.seed === 'samples') {
    seedVehicleSalesSampleData_(ss);
    if (e.parameter.format === 'json') {
      return ContentService.createTextOutput(JSON.stringify({
        ok: true,
        seeded: true,
        spreadsheetUrl: ss.getUrl()
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  const template = HtmlService.createTemplateFromFile('vehicle_sales_webapp');
  template.bootstrap = JSON.stringify(getVehicleSalesAppPayload_());
  template.css = getVehicleSalesPartialContent_('vehicle_sales_webapp_css', 'style');
  template.js = getVehicleSalesPartialContent_('vehicle_sales_webapp_js', 'script');

  return template.evaluate()
    .setTitle('Vehicle Flow Studio')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getVehicleSalesPartialContent_(filename, tagName) {
  const html = HtmlService.createHtmlOutputFromFile(filename).getContent();
  const openTagPattern = new RegExp('^\\s*<' + tagName + '[^>]*>');
  const closeTagPattern = new RegExp('<\\/' + tagName + '>\\s*$');
  return html.replace(openTagPattern, '').replace(closeTagPattern, '').trim();
}

function getVehicleSalesAppPayload() {
  return getVehicleSalesAppPayload_();
}

function saveVehicleSalesAppPayload(payload) {
  const sanitized = sanitizeVehicleSalesPayload_(payload);
  const ss = ensureVehicleSalesAppSpreadsheet_();

  replaceVehicleSalesSheetValues_(
    ss.getSheetByName(VEHICLE_SALES_APP.sheets.deals),
    VEHICLE_SALES_APP.headers.deals,
    sanitized.deals.map(function(item) {
      return [
        item.id,
        item.caseNumber,
        item.caseName,
        item.brand,
        item.vehicleName,
        item.vehicleKey,
        item.sourceType,
        item.sourceName,
        item.ownerType,
        item.ownerName,
        item.custodyType,
        item.custodyName,
        item.buyerType,
        item.buyerName,
        item.ownershipScheme,
        item.settlementMode,
        item.dealType,
        item.progress,
        item.inventoryStage,
        item.recognitionRule,
        item.loanSettlement,
        item.caseDate,
        item.orderDate,
        item.registrationPlanDate,
        item.registrationDate,
        item.saleAmountTaxIn,
        item.saleAmountTaxEx,
        item.expectedProfit,
        item.confirmedProfit,
        item.referralSales,
        item.referralProfit,
        item.relatedCase,
        item.memo,
        new Date()
      ];
    })
  );

  replaceVehicleSalesSheetValues_(
    ss.getSheetByName(VEHICLE_SALES_APP.sheets.cashouts),
    VEHICLE_SALES_APP.headers.cashouts,
    sanitized.cashouts.map(function(item) {
      return [
        item.id,
        item.dealId,
        item.occurredOn,
        item.flowType,
        item.flowDirection,
        item.vehicleName,
        item.caseLabel,
        item.counterpartyType,
        item.counterpartyName,
        item.appraisalAmount,
        item.purchaseAmount,
        item.loanBalance,
        item.loanPaymentAmount,
        item.cashMovementAmount,
        item.scheduledOn,
        item.moneyLane,
        item.revenueTarget,
        item.profitTarget,
        item.relatedCase,
        item.progressNote,
        item.memo,
        new Date()
      ];
    })
  );

  replaceVehicleSalesSheetValues_(
    ss.getSheetByName(VEHICLE_SALES_APP.sheets.recognitions),
    VEHICLE_SALES_APP.headers.recognitions,
    sanitized.recognitions.map(function(item) {
      return [
        item.id,
        item.dealId,
        item.recognizedOn,
        item.recognitionType,
        item.salesType,
        item.salesAmountTaxEx,
        item.profitAmountTaxEx,
        item.confirmationRule,
        item.linkedParty,
        item.memo,
        new Date()
      ];
    })
  );

  replaceVehicleSalesSheetValues_(
    ss.getSheetByName(VEHICLE_SALES_APP.sheets.progressLogs),
    VEHICLE_SALES_APP.headers.progressLogs,
    sanitized.progressLogs.map(function(item) {
      return [
        item.id,
        item.dealId,
        item.loggedOn,
        item.activityKind,
        item.activityPhase,
        item.counterpartyType,
        item.counterpartyName,
        item.summary,
        item.nextActionOn,
        item.nextAction,
        item.activityStatus,
        item.progressUpdate,
        item.inventoryUpdate,
        item.memo,
        new Date()
      ];
    })
  );

  formatVehicleSalesCashMovementSheet_(ss.getSheetByName(VEHICLE_SALES_APP.sheets.cashouts));
  rebuildVehicleSalesDerivedSheets_(ss, sanitized);
  applyVehicleSalesInputValidations_(ss);
  return getVehicleSalesAppPayload_();
}

function seedVehicleSalesSampleData_(ss) {
  const payload = sanitizeVehicleSalesPayload_(buildVehicleSalesSamplePayload_());

  replaceVehicleSalesSheetValues_(
    ss.getSheetByName(VEHICLE_SALES_APP.sheets.deals),
    VEHICLE_SALES_APP.headers.deals,
    payload.deals.map(function(item) {
      return [
        item.id,
        item.caseNumber,
        item.caseName,
        item.brand,
        item.vehicleName,
        item.vehicleKey,
        item.sourceType,
        item.sourceName,
        item.ownerType,
        item.ownerName,
        item.custodyType,
        item.custodyName,
        item.buyerType,
        item.buyerName,
        item.ownershipScheme,
        item.settlementMode,
        item.dealType,
        item.progress,
        item.inventoryStage,
        item.recognitionRule,
        item.loanSettlement,
        item.caseDate,
        item.orderDate,
        item.registrationPlanDate,
        item.registrationDate,
        item.saleAmountTaxIn,
        item.saleAmountTaxEx,
        item.expectedProfit,
        item.confirmedProfit,
        item.referralSales,
        item.referralProfit,
        item.relatedCase,
        item.memo,
        new Date()
      ];
    })
  );

  replaceVehicleSalesSheetValues_(
    ss.getSheetByName(VEHICLE_SALES_APP.sheets.cashouts),
    VEHICLE_SALES_APP.headers.cashouts,
    payload.cashouts.map(function(item) {
      return [
        item.id,
        item.dealId,
        item.occurredOn,
        item.flowType,
        item.flowDirection,
        item.vehicleName,
        item.caseLabel,
        item.counterpartyType,
        item.counterpartyName,
        item.appraisalAmount,
        item.purchaseAmount,
        item.loanBalance,
        item.loanPaymentAmount,
        item.cashMovementAmount,
        item.scheduledOn,
        item.moneyLane,
        item.revenueTarget,
        item.profitTarget,
        item.relatedCase,
        item.progressNote,
        item.memo,
        new Date()
      ];
    })
  );

  replaceVehicleSalesSheetValues_(
    ss.getSheetByName(VEHICLE_SALES_APP.sheets.recognitions),
    VEHICLE_SALES_APP.headers.recognitions,
    payload.recognitions.map(function(item) {
      return [
        item.id,
        item.dealId,
        item.recognizedOn,
        item.recognitionType,
        item.salesType,
        item.salesAmountTaxEx,
        item.profitAmountTaxEx,
        item.confirmationRule,
        item.linkedParty,
        item.memo,
        new Date()
      ];
    })
  );

  replaceVehicleSalesSheetValues_(
    ss.getSheetByName(VEHICLE_SALES_APP.sheets.progressLogs),
    VEHICLE_SALES_APP.headers.progressLogs,
    payload.progressLogs.map(function(item) {
      return [
        item.id,
        item.dealId,
        item.loggedOn,
        item.activityKind,
        item.activityPhase,
        item.counterpartyType,
        item.counterpartyName,
        item.summary,
        item.nextActionOn,
        item.nextAction,
        item.activityStatus,
        item.progressUpdate,
        item.inventoryUpdate,
        item.memo,
        new Date()
      ];
    })
  );

  formatVehicleSalesCashMovementSheet_(ss.getSheetByName(VEHICLE_SALES_APP.sheets.cashouts));
  rebuildVehicleSalesDerivedSheets_(ss, payload);
  applyVehicleSalesInputValidations_(ss);
}

function buildVehicleSalesSamplePayload_() {
  return {
    deals: [
      {
        id: 'deal_vs_0001',
        caseNumber: 'VS-0001',
        caseName: 'レンジローバー入替案件',
        brand: 'JLR中古車',
        vehicleName: 'レンジローバー',
        vehicleKey: 'RRGT-001',
        sourceType: '顧客',
        sourceName: '後藤 昇',
        ownerType: 'コンクエスト',
        ownerName: 'コンクエスト',
        custodyType: 'BRIDGE',
        custodyName: 'BRIDGE広島',
        buyerType: '個人客',
        buyerName: '新規顧客A',
        ownershipScheme: '顧客買取→コンクエスト名義',
        settlementMode: '月末相殺',
        dealType: '下取',
        progress: '登録待ち',
        inventoryStage: '仕入予定',
        recognitionRule: '案件別判定',
        loanSettlement: 'あり',
        caseDate: '2026-05-10',
        orderDate: '2026-05-18',
        registrationPlanDate: '2026-05-28',
        registrationDate: '',
        saleAmountTaxIn: 15600000,
        saleAmountTaxEx: 14181818,
        expectedProfit: 980000,
        confirmedProfit: 0,
        referralSales: 0,
        referralProfit: 0,
        relatedCase: '新車乗換',
        memo: '残債精算あり。顧客からの下取後に別顧客へ売却予定。'
      },
      {
        id: 'deal_vs_0002',
        caseNumber: 'VS-0002',
        caseName: 'ディフェンダー紹介料案件',
        brand: 'JLR新車',
        vehicleName: 'ディフェンダー',
        vehicleKey: 'DEF-REF-01',
        sourceType: 'コンクエスト',
        sourceName: 'コンクエスト',
        ownerType: 'コンクエスト',
        ownerName: 'コンクエスト',
        custodyType: 'コンクエスト',
        custodyName: 'コンクエスト',
        buyerType: '個人客',
        buyerName: '紹介先顧客',
        ownershipScheme: 'コンクエスト紹介',
        settlementMode: '都度精算',
        dealType: '紹介',
        progress: '完了',
        inventoryStage: '完了',
        recognitionRule: '紹介料売上=利益',
        loanSettlement: 'なし',
        caseDate: '2026-05-02',
        orderDate: '2026-05-03',
        registrationPlanDate: '',
        registrationDate: '2026-05-15',
        saleAmountTaxIn: 0,
        saleAmountTaxEx: 0,
        expectedProfit: 300000,
        confirmedProfit: 300000,
        referralSales: 300000,
        referralProfit: 300000,
        relatedCase: '紹介料計上のみ',
        memo: '売上と利益は紹介料のみ。'
      },
      {
        id: 'deal_vs_0003',
        caseNumber: 'VS-0003',
        caseName: 'G400d在庫販売案件',
        brand: '他社＆業販',
        vehicleName: 'G400d',
        vehicleKey: 'G400D-003',
        sourceType: '業者',
        sourceName: '業者オークション',
        ownerType: 'BRIDGE',
        ownerName: 'BRIDGE',
        custodyType: 'BRIDGE',
        custodyName: 'BRIDGE展示場',
        buyerType: '個人客',
        buyerName: '商談中顧客B',
        ownershipScheme: '自社在庫',
        settlementMode: 'なし',
        dealType: '在庫販売',
        progress: '商談中',
        inventoryStage: '在庫',
        recognitionRule: '入金時確定',
        loanSettlement: 'なし',
        caseDate: '2026-04-25',
        orderDate: '',
        registrationPlanDate: '',
        registrationDate: '',
        saleAmountTaxIn: 12800000,
        saleAmountTaxEx: 11636364,
        expectedProfit: 650000,
        confirmedProfit: 0,
        referralSales: 0,
        referralProfit: 0,
        relatedCase: '',
        memo: '在庫車。申込金のみ受領済み。'
      },
      {
        id: 'deal_vs_0004',
        caseNumber: 'VS-0004',
        caseName: 'ディスカバリースポーツ販売完了',
        brand: 'JLR中古車',
        vehicleName: 'ディスカバリースポーツ',
        vehicleKey: 'DISC-004',
        sourceType: '業者',
        sourceName: '業者仕入先C',
        ownerType: 'BRIDGE',
        ownerName: 'BRIDGE',
        custodyType: '納車済',
        custodyName: '顧客先',
        buyerType: '業販',
        buyerName: '業販先D',
        ownershipScheme: '通常',
        settlementMode: '都度精算',
        dealType: '業販',
        progress: '完了',
        inventoryStage: '完了',
        recognitionRule: '通常',
        loanSettlement: 'なし',
        caseDate: '2026-04-08',
        orderDate: '2026-04-16',
        registrationPlanDate: '2026-04-24',
        registrationDate: '2026-04-24',
        saleAmountTaxIn: 2350000,
        saleAmountTaxEx: 2136364,
        expectedProfit: 320000,
        confirmedProfit: 320000,
        referralSales: 0,
        referralProfit: 0,
        relatedCase: '',
        memo: '業販完了済み。'
      },
      {
        id: 'deal_vs_0005',
        caseNumber: 'VS-0005',
        caseName: 'レンジローバースポーツ コンクエスト納車待ち',
        brand: 'JLR新車',
        vehicleName: 'レンジローバースポーツ',
        vehicleKey: 'RRS-005',
        sourceType: 'コンクエスト',
        sourceName: 'コンクエスト',
        ownerType: 'コンクエスト',
        ownerName: 'コンクエスト',
        custodyType: 'コンクエスト',
        custodyName: 'コンクエスト',
        buyerType: '個人客',
        buyerName: '佐々木 大輔',
        ownershipScheme: 'コンクエスト紹介',
        settlementMode: '月末相殺',
        dealType: '紹介',
        progress: '登録待ち',
        inventoryStage: '売約',
        recognitionRule: '紹介料売上=利益',
        loanSettlement: 'なし',
        caseDate: '2026-05-01',
        orderDate: '2026-05-09',
        registrationPlanDate: '2026-06-10',
        registrationDate: '',
        saleAmountTaxIn: 18900000,
        saleAmountTaxEx: 17181818,
        expectedProfit: 450000,
        confirmedProfit: 0,
        referralSales: 0,
        referralProfit: 0,
        relatedCase: 'コンクエスト案件',
        memo: '注文書あり。紹介料見込のみ、利益未確定。'
      }
    ],
    cashouts: [
      {
        id: 'cash_vs_0001_1',
        dealId: 'deal_vs_0001',
        occurredOn: '2026-05-11',
        flowType: '残債一括返済',
        flowDirection: '出金',
        vehicleName: 'レンジローバー',
        caseLabel: 'レンジローバー入替案件',
        counterpartyType: 'ローン会社',
        counterpartyName: 'ジャックス',
        appraisalAmount: 14700000,
        purchaseAmount: 0,
        loanBalance: 4200000,
        loanPaymentAmount: 4200000,
        cashMovementAmount: 4200000,
        scheduledOn: '2026-05-20',
        moneyLane: 'ローン会社向け',
        revenueTarget: '対象外',
        profitTarget: '対象外',
        relatedCase: '新車乗換',
        progressNote: '契約後に一括返済予定',
        memo: '売上ではなく資金移動として管理'
      },
      {
        id: 'cash_vs_0001_2',
        dealId: 'deal_vs_0001',
        occurredOn: '2026-05-12',
        flowType: '顧客買取支払',
        flowDirection: '出金',
        vehicleName: 'レンジローバー',
        caseLabel: 'レンジローバー入替案件',
        counterpartyType: '顧客',
        counterpartyName: '後藤 昇',
        appraisalAmount: 14700000,
        purchaseAmount: 14000000,
        loanBalance: 0,
        loanPaymentAmount: 0,
        cashMovementAmount: 14000000,
        scheduledOn: '2026-05-21',
        moneyLane: '顧客向け',
        revenueTarget: '対象外',
        profitTarget: '対象外',
        relatedCase: '新車乗換',
        progressNote: '買取精算待ち',
        memo: ''
      },
      {
        id: 'cash_vs_0001_3',
        dealId: 'deal_vs_0001',
        occurredOn: '2026-05-18',
        flowType: '差額精算',
        flowDirection: '入金',
        vehicleName: 'レンジローバー',
        caseLabel: 'レンジローバー入替案件',
        counterpartyType: '顧客',
        counterpartyName: '新規顧客A',
        appraisalAmount: 0,
        purchaseAmount: 0,
        loanBalance: 0,
        loanPaymentAmount: 0,
        cashMovementAmount: 2600000,
        scheduledOn: '2026-05-18',
        moneyLane: '顧客向け',
        revenueTarget: '対象外',
        profitTarget: '対象外',
        relatedCase: '頭金',
        progressNote: '契約金受領済み',
        memo: ''
      },
      {
        id: 'cash_vs_0003_1',
        dealId: 'deal_vs_0003',
        occurredOn: '2026-04-26',
        flowType: '仕入支払',
        flowDirection: '出金',
        vehicleName: 'G400d',
        caseLabel: 'G400d在庫販売案件',
        counterpartyType: '業者',
        counterpartyName: '業者オークション',
        appraisalAmount: 0,
        purchaseAmount: 11450000,
        loanBalance: 0,
        loanPaymentAmount: 0,
        cashMovementAmount: 11450000,
        scheduledOn: '2026-04-28',
        moneyLane: '業者向け',
        revenueTarget: '対象外',
        profitTarget: '対象外',
        relatedCase: '',
        progressNote: '仕入代支払済み',
        memo: ''
      },
      {
        id: 'cash_vs_0003_2',
        dealId: 'deal_vs_0003',
        occurredOn: '2026-05-02',
        flowType: '差額精算',
        flowDirection: '入金',
        vehicleName: 'G400d',
        caseLabel: 'G400d在庫販売案件',
        counterpartyType: '顧客',
        counterpartyName: '商談中顧客B',
        appraisalAmount: 0,
        purchaseAmount: 0,
        loanBalance: 0,
        loanPaymentAmount: 0,
        cashMovementAmount: 500000,
        scheduledOn: '2026-05-02',
        moneyLane: '顧客向け',
        revenueTarget: '対象外',
        profitTarget: '対象外',
        relatedCase: '申込金',
        progressNote: '申込金受領済み',
        memo: ''
      },
      {
        id: 'cash_vs_0004_1',
        dealId: 'deal_vs_0004',
        occurredOn: '2026-04-08',
        flowType: '仕入支払',
        flowDirection: '出金',
        vehicleName: 'ディスカバリースポーツ',
        caseLabel: 'ディスカバリースポーツ販売完了',
        counterpartyType: '業者',
        counterpartyName: '業者仕入先C',
        appraisalAmount: 0,
        purchaseAmount: 1687324,
        loanBalance: 0,
        loanPaymentAmount: 0,
        cashMovementAmount: 1687324,
        scheduledOn: '2026-04-08',
        moneyLane: '業者向け',
        revenueTarget: '対象外',
        profitTarget: '対象外',
        relatedCase: '',
        progressNote: '仕入支払完了',
        memo: ''
      },
      {
        id: 'cash_vs_0004_2',
        dealId: 'deal_vs_0004',
        occurredOn: '2026-04-24',
        flowType: '売上入金',
        flowDirection: '入金',
        vehicleName: 'ディスカバリースポーツ',
        caseLabel: 'ディスカバリースポーツ販売完了',
        counterpartyType: '業者',
        counterpartyName: '業販先D',
        appraisalAmount: 0,
        purchaseAmount: 0,
        loanBalance: 0,
        loanPaymentAmount: 0,
        cashMovementAmount: 2350000,
        scheduledOn: '2026-04-24',
        moneyLane: '売上回収',
        revenueTarget: '対象',
        profitTarget: '対象',
        relatedCase: '',
        progressNote: '売上入金完了',
        memo: ''
      }
    ],
    recognitions: [
      {
        id: 'rec_vs_0002_1',
        dealId: 'deal_vs_0002',
        recognizedOn: '2026-05-15',
        recognitionType: '紹介料',
        salesType: '紹介料売上',
        salesAmountTaxEx: 300000,
        profitAmountTaxEx: 300000,
        confirmationRule: '紹介料入金',
        linkedParty: 'コンクエスト',
        memo: '売上=利益'
      },
      {
        id: 'rec_vs_0004_1',
        dealId: 'deal_vs_0004',
        recognizedOn: '2026-04-24',
        recognitionType: '車両売上',
        salesType: '本体売上',
        salesAmountTaxEx: 2350000,
        profitAmountTaxEx: 320000,
        confirmationRule: '納車完了',
        linkedParty: '業販先D',
        memo: '販売完了'
      }
    ],
    progressLogs: [
      {
        id: 'log_vs_0001_1',
        dealId: 'deal_vs_0001',
        loggedOn: '2026-05-10',
        activityKind: 'やり取り',
        activityPhase: '下取査定',
        counterpartyType: '顧客',
        counterpartyName: '後藤 昇',
        summary: '下取査定提示。残債整理の流れを説明。',
        nextActionOn: '2026-05-18',
        nextAction: '契約締結と差額入金確認',
        activityStatus: '進行中',
        progressUpdate: '受注',
        inventoryUpdate: '仕入予定',
        memo: ''
      },
      {
        id: 'log_vs_0001_2',
        dealId: 'deal_vs_0001',
        loggedOn: '2026-05-18',
        activityKind: '完了記録',
        activityPhase: '入金確認',
        counterpartyType: '顧客',
        counterpartyName: '新規顧客A',
        summary: '契約金入金確認。',
        nextActionOn: '2026-05-28',
        nextAction: '登録準備',
        activityStatus: '進行中',
        progressUpdate: '登録待ち',
        inventoryUpdate: '仕入予定',
        memo: ''
      },
      {
        id: 'log_vs_0003_1',
        dealId: 'deal_vs_0003',
        loggedOn: '2026-05-02',
        activityKind: 'やり取り',
        activityPhase: '受注',
        counterpartyType: '顧客',
        counterpartyName: '商談中顧客B',
        summary: '申込金を受領。条件調整中。',
        nextActionOn: '2026-05-25',
        nextAction: '正式契約可否確認',
        activityStatus: '進行中',
        progressUpdate: '商談中',
        inventoryUpdate: '在庫',
        memo: ''
      },
      {
        id: 'log_vs_0004_1',
        dealId: 'deal_vs_0004',
        loggedOn: '2026-04-24',
        activityKind: '完了記録',
        activityPhase: '納車',
        counterpartyType: '業者',
        counterpartyName: '業販先D',
        summary: '納車完了、請求回収済み。',
        nextActionOn: '',
        nextAction: '',
        activityStatus: '完了',
        progressUpdate: '完了',
        inventoryUpdate: '完了',
        memo: ''
      },
      {
        id: 'log_vs_0005_1',
        dealId: 'deal_vs_0005',
        loggedOn: '2026-05-09',
        activityKind: 'やり取り',
        activityPhase: '受注',
        counterpartyType: 'コンクエスト',
        counterpartyName: 'コンクエスト',
        summary: '注文書受領。紹介料見込を確認。',
        nextActionOn: '2026-06-10',
        nextAction: '登録・納車予定確認',
        activityStatus: '進行中',
        progressUpdate: '登録待ち',
        inventoryUpdate: '売約',
        memo: ''
      }
    ]
  };
}

function setupVehicleSalesApp() {
  const ss = ensureVehicleSalesAppSpreadsheet_();
  return {
    ok: true,
    spreadsheetId: ss.getId(),
    spreadsheetUrl: ss.getUrl(),
    usageHint: getVehicleSalesAppUsageHint_()
  };
}

function getVehicleSalesAppUsageHint() {
  return getVehicleSalesAppUsageHint_();
}

function getVehicleSalesAppUsageHint_() {
  const serviceUrl = ScriptApp.getService().getUrl();
  if (!serviceUrl) {
    return 'Web アプリをデプロイ後、URL の末尾に ?app=' + VEHICLE_SALES_APP.appParam + ' を付けて開いてください。';
  }
  return serviceUrl + '?app=' + VEHICLE_SALES_APP.appParam;
}

function ensureVehicleSalesAppSpreadsheet_() {
  const props = PropertiesService.getScriptProperties();
  const existingId = props.getProperty(VEHICLE_SALES_APP.propertyKey);
  let ss = null;

  if (existingId) {
    try {
      ss = SpreadsheetApp.openById(existingId);
    } catch (error) {
      ss = null;
    }
  }

  if (!ss) {
    ss = SpreadsheetApp.create(VEHICLE_SALES_APP.spreadsheetName);
    props.setProperty(VEHICLE_SALES_APP.propertyKey, ss.getId());
  }

  migrateVehicleSalesSheetNames_(ss);
  getOrCreateVehicleSalesSheet_(ss, VEHICLE_SALES_APP.sheets.guide);
  getOrCreateVehicleSalesSheet_(ss, VEHICLE_SALES_APP.sheets.calendar);
  getOrCreateVehicleSalesSheet_(ss, VEHICLE_SALES_APP.sheets.dealSummary, VEHICLE_SALES_APP.headers.dealSummary);
  getOrCreateVehicleSalesSheet_(ss, VEHICLE_SALES_APP.sheets.ownershipBoard, VEHICLE_SALES_APP.headers.ownershipBoard);
  getOrCreateVehicleSalesSheet_(ss, VEHICLE_SALES_APP.sheets.cashoutExport, VEHICLE_SALES_APP.headers.cashoutExport);
  getOrCreateVehicleSalesSheet_(ss, VEHICLE_SALES_APP.sheets.dealLedger, VEHICLE_SALES_APP.headers.dealLedger);
  getOrCreateVehicleSalesSheet_(ss, VEHICLE_SALES_APP.sheets.progressBoard, VEHICLE_SALES_APP.headers.progressBoard);
  getOrCreateVehicleSalesSheet_(ss, VEHICLE_SALES_APP.sheets.deals, VEHICLE_SALES_APP.headers.deals);
  getOrCreateVehicleSalesSheet_(ss, VEHICLE_SALES_APP.sheets.cashouts, VEHICLE_SALES_APP.headers.cashouts);
  getOrCreateVehicleSalesSheet_(ss, VEHICLE_SALES_APP.sheets.recognitions, VEHICLE_SALES_APP.headers.recognitions);
  getOrCreateVehicleSalesSheet_(ss, VEHICLE_SALES_APP.sheets.progressLogs, VEHICLE_SALES_APP.headers.progressLogs);
  applyVehicleSalesInputValidations_(ss);
  formatVehicleSalesCashMovementSheet_(ss.getSheetByName(VEHICLE_SALES_APP.sheets.cashouts));
  arrangeVehicleSalesSheets_(ss);

  return ss;
}

function getOrCreateVehicleSalesSheet_(ss, sheetName, headers) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  if (headers && headers.length) {
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    const currentLastColumn = Math.max(sheet.getLastColumn(), headers.length);
    const currentHeaders = sheet.getRange(1, 1, 1, currentLastColumn).getValues()[0].map(function(item) {
      return String(item || '').trim();
    });
    if (headers.join('\t') !== currentHeaders.join('\t')) {
      const existingRows = readVehicleSalesSheetObjects_(sheet);
      sheet.clearContents();
      headerRange.setValues([headers]).setFontWeight('bold');
      if (existingRows.length) {
        const rows = existingRows.map(function(item) {
          return headers.map(function(header) {
            return Object.prototype.hasOwnProperty.call(item, header) ? item[header] : '';
          });
        });
        sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
      }
      sheet.setFrozenRows(1);
    }
  }
  return sheet;
}

function replaceVehicleSalesSheetValues_(sheet, headers, rows) {
  const filter = sheet.getFilter();
  if (filter) {
    filter.remove();
  }

  sheet.clear();
  sheet.getRange(1, 1, 1, headers.length)
    .setValues([headers])
    .setFontWeight('bold')
    .setFontColor('#ffffff')
    .setBackground('#2f5f8f');
  sheet.setFrozenRows(1);
  if (rows.length) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
  if (sheet.getLastRow() > 1) {
    sheet.getRange(1, 1, sheet.getLastRow(), headers.length).createFilter();
  }
  sheet.getDataRange().setWrap(true);
  sheet.autoResizeColumns(1, headers.length);
}

function applyVehicleSalesInputValidations_(ss) {
  const dealsSheet = ss.getSheetByName(VEHICLE_SALES_APP.sheets.deals);
  if (dealsSheet) {
    applyVehicleSalesColumnValidation_(dealsSheet, 'ブランド', VEHICLE_SALES_APP.defaults.brands);
    applyVehicleSalesColumnValidation_(dealsSheet, '仕入元区分', VEHICLE_SALES_APP.defaults.sourceTypes);
    applyVehicleSalesColumnValidation_(dealsSheet, '現在所有者区分', VEHICLE_SALES_APP.defaults.ownerTypes);
    applyVehicleSalesColumnValidation_(dealsSheet, '保管先区分', VEHICLE_SALES_APP.defaults.custodyTypes);
    applyVehicleSalesColumnValidation_(dealsSheet, '売却先区分', VEHICLE_SALES_APP.defaults.buyerTypes);
    applyVehicleSalesColumnValidation_(dealsSheet, '所有権スキーム', VEHICLE_SALES_APP.defaults.ownershipSchemes);
    applyVehicleSalesColumnValidation_(dealsSheet, 'コンクエスト精算方式', VEHICLE_SALES_APP.defaults.settlementModes);
    applyVehicleSalesColumnValidation_(dealsSheet, '案件区分', VEHICLE_SALES_APP.defaults.dealTypes);
    applyVehicleSalesColumnValidation_(dealsSheet, '進捗', VEHICLE_SALES_APP.defaults.progress);
    applyVehicleSalesColumnValidation_(dealsSheet, '在庫状態', VEHICLE_SALES_APP.defaults.inventoryStages);
    applyVehicleSalesColumnValidation_(dealsSheet, '利益計上ルール', VEHICLE_SALES_APP.defaults.recognitionRules);
    applyVehicleSalesColumnValidation_(dealsSheet, '残債精算あり', VEHICLE_SALES_APP.defaults.loanFlags);
  }

  const progressLogsSheet = ss.getSheetByName(VEHICLE_SALES_APP.sheets.progressLogs);
  if (progressLogsSheet) {
    applyVehicleSalesColumnValidation_(progressLogsSheet, '記録区分', VEHICLE_SALES_APP.defaults.activityKinds);
    applyVehicleSalesColumnValidation_(progressLogsSheet, '工程区分', VEHICLE_SALES_APP.defaults.activityPhases);
    applyVehicleSalesColumnValidation_(progressLogsSheet, '相手先区分', VEHICLE_SALES_APP.defaults.counterpartyTypes);
    applyVehicleSalesColumnValidation_(progressLogsSheet, '完了状況', VEHICLE_SALES_APP.defaults.activityStatuses);
    applyVehicleSalesColumnValidation_(progressLogsSheet, '案件進捗更新', [''].concat(VEHICLE_SALES_APP.defaults.progress));
    applyVehicleSalesColumnValidation_(progressLogsSheet, '在庫状態更新', [''].concat(VEHICLE_SALES_APP.defaults.inventoryStages));
  }
}

function applyVehicleSalesColumnValidation_(sheet, headerName, values) {
  const column = findVehicleSalesHeaderColumn_(sheet, headerName);
  if (!column || !values || !values.length) {
    return;
  }
  const rowCount = Math.max(sheet.getMaxRows() - 1, 1);
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(values, true)
    .setAllowInvalid(true)
    .build();
  sheet.getRange(2, column, rowCount, 1).setDataValidation(rule);
}

function findVehicleSalesHeaderColumn_(sheet, headerName) {
  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  for (var index = 0; index < headers.length; index += 1) {
    if (String(headers[index] || '').trim() === headerName) {
      return index + 1;
    }
  }
  return 0;
}

function rebuildVehicleSalesDerivedSheets_(ss, payload) {
  const guideSheet = ss.getSheetByName(VEHICLE_SALES_APP.sheets.guide);
  const progressBoardSheet = ss.getSheetByName(VEHICLE_SALES_APP.sheets.progressBoard);
  const calendarSheet = ss.getSheetByName(VEHICLE_SALES_APP.sheets.calendar);
  const ownershipBoardSheet = ss.getSheetByName(VEHICLE_SALES_APP.sheets.ownershipBoard);
  const cashoutExportSheet = ss.getSheetByName(VEHICLE_SALES_APP.sheets.cashoutExport);
  const dealSummarySheet = ss.getSheetByName(VEHICLE_SALES_APP.sheets.dealSummary);
  const dealLedgerSheet = ss.getSheetByName(VEHICLE_SALES_APP.sheets.dealLedger);
  const summaries = buildVehicleSalesFlowSummaries_(payload);
  const activitySummaries = buildVehicleSalesActivitySummaries_(payload);
  const profitSummaries = buildVehicleSalesProfitSummaries_(payload);
  const calendarData = buildVehicleSalesCashCalendar_(payload);
  const dealLedgerRows = buildVehicleSalesDealLedgerRows_(payload);
  const sortedCashouts = payload.cashouts.filter(function(item) {
    return item.flowDirection === '出金';
  }).sort(compareVehicleSalesSheetDates_);
  const sortedDeals = payload.deals.slice().sort(compareVehicleSalesDealsForSummary_);
  const dealMap = createVehicleSalesDealMap_(payload.deals);

  renderVehicleSalesGuideSheet_(guideSheet);
  replaceVehicleSalesSheetValues_(
    progressBoardSheet,
    VEHICLE_SALES_APP.headers.progressBoard,
    sortedDeals.map(function(item) {
      const flowSummary = summaries[item.id] || createVehicleSalesFlowSummary_(item.loanSettlement);
      const activitySummary = activitySummaries[item.id] || createVehicleSalesActivitySummary_();
      return [
        item.caseNumber,
        item.caseName,
        item.buyerName || item.sourceName || '',
        item.brand,
        item.vehicleName,
        item.vehicleKey,
        item.progress,
        item.inventoryStage,
        activitySummary.lastLoggedOn,
        activitySummary.lastSummary,
        activitySummary.nextActionOn,
        activitySummary.nextAction,
        activitySummary.openCount,
        activitySummary.openSummary,
        flowSummary.inflow - flowSummary.outflow,
        Math.max(flowSummary.loanPaymentAmount - activitySummary.loanCompletedAmount, 0),
        [item.memo, activitySummary.memo].filter(Boolean).join(' / ')
      ];
    })
  );
  renderVehicleSalesCalendarSheet_(calendarSheet, calendarData);

  replaceVehicleSalesSheetValues_(
    ownershipBoardSheet,
    VEHICLE_SALES_APP.headers.ownershipBoard,
    sortedDeals.map(function(item) {
      return [
        item.caseNumber,
        item.caseName,
        item.brand,
        item.vehicleName,
        item.vehicleKey,
        [item.sourceType, item.sourceName].filter(Boolean).join(' / '),
        [item.ownerType, item.ownerName].filter(Boolean).join(' / '),
        [item.custodyType, item.custodyName].filter(Boolean).join(' / '),
        [item.buyerType, item.buyerName].filter(Boolean).join(' / '),
        item.ownershipScheme,
        item.settlementMode,
        item.progress,
        item.memo
      ];
    })
  );

  replaceVehicleSalesSheetValues_(
    cashoutExportSheet,
    VEHICLE_SALES_APP.headers.cashoutExport,
    sortedCashouts.map(function(item) {
      const deal = dealMap[item.dealId] || {};
      return [
        item.scheduledOn,
        item.dealId,
        deal.caseNumber || '',
        deal.vehicleKey || '',
        item.caseLabel || deal.caseName || '',
        item.vehicleName || deal.vehicleName || '',
        deal.buyerName || '',
        [deal.ownerType, deal.ownerName].filter(Boolean).join(' / '),
        item.flowType,
        item.moneyLane || '',
        item.counterpartyType,
        item.counterpartyName,
        item.cashMovementAmount,
        item.appraisalAmount,
        item.purchaseAmount,
        item.loanBalance,
        item.loanPaymentAmount,
        item.progressNote,
        item.revenueTarget,
        item.profitTarget,
        item.relatedCase,
        item.memo
      ];
    })
  );

  replaceVehicleSalesSheetValues_(
    dealSummarySheet,
    VEHICLE_SALES_APP.headers.dealSummary,
    sortedDeals.map(function(item) {
      const summary = summaries[item.id] || createVehicleSalesFlowSummary_(item.loanSettlement);
      const profitSummary = profitSummaries[item.id] || createVehicleSalesProfitSummary_();
      return [
        item.caseNumber,
        item.caseName,
        [item.brand, item.vehicleName].filter(Boolean).join(' / '),
        item.vehicleKey,
        [item.sourceName, item.buyerName].filter(Boolean).join(' / '),
        profitSummary.types.join(' / '),
        summary.sales,
        summary.profit,
        profitSummary.breakdown.join(' / '),
        summary.inflow - summary.outflow,
        [item.progress, item.inventoryStage].filter(Boolean).join(' / '),
        profitSummary.parties.join(' / '),
        [item.memo, profitSummary.memo].filter(Boolean).join(' / ')
      ];
    })
  );

  replaceVehicleSalesSheetValues_(
    dealLedgerSheet,
    VEHICLE_SALES_APP.headers.dealLedger,
      dealLedgerRows
    );

  formatVehicleSalesOwnershipSheet_(ownershipBoardSheet);
  formatVehicleSalesProgressBoardSheet_(progressBoardSheet);
  formatVehicleSalesExportSheet_(cashoutExportSheet);
  formatVehicleSalesSummarySheet_(dealSummarySheet);
  formatVehicleSalesLedgerSheet_(dealLedgerSheet);
  arrangeVehicleSalesSheets_(ss);
}

function getVehicleSalesAppPayload_() {
  const ss = ensureVehicleSalesAppSpreadsheet_();
  const deals = readVehicleSalesSheetObjects_(ss.getSheetByName(VEHICLE_SALES_APP.sheets.deals));
  const cashouts = readVehicleSalesSheetObjects_(ss.getSheetByName(VEHICLE_SALES_APP.sheets.cashouts));
  const recognitions = readVehicleSalesSheetObjects_(ss.getSheetByName(VEHICLE_SALES_APP.sheets.recognitions));
  const progressLogs = readVehicleSalesSheetObjects_(ss.getSheetByName(VEHICLE_SALES_APP.sheets.progressLogs));

  const payload = sanitizeVehicleSalesPayload_({
    spreadsheetUrl: ss.getUrl(),
    appUrl: getVehicleSalesAppUsageHint_(),
    options: VEHICLE_SALES_APP.defaults,
    deals: deals.map(function(item) {
      return {
        id: item.id,
        caseNumber: item['案件番号'],
        caseName: item['案件名'],
        brand: item['ブランド'],
        vehicleName: item['車種'],
        vehicleKey: item['車両管理キー'],
        sourceType: item['仕入元区分'],
        sourceName: item['仕入元名'],
        ownerType: item['現在所有者区分'],
        ownerName: item['現在所有者名'],
        custodyType: item['保管先区分'],
        custodyName: item['保管先名'],
        buyerType: item['売却先区分'],
        buyerName: item['売却先名'],
        ownershipScheme: item['所有権スキーム'],
        settlementMode: item['コンクエスト精算方式'],
        dealType: item['案件区分'],
        progress: item['進捗'],
        inventoryStage: item['在庫状態'],
        recognitionRule: item['利益計上ルール'],
        loanSettlement: item['残債精算あり'],
        caseDate: normalizeVehicleSalesDate_(item['案件発生日']),
        orderDate: normalizeVehicleSalesDate_(item['受注日']),
        registrationPlanDate: normalizeVehicleSalesDate_(item['登録予定日']),
        registrationDate: normalizeVehicleSalesDate_(item['登録決定日']),
        saleAmountTaxIn: Number(item['販売売上税込']) || 0,
        saleAmountTaxEx: Number(item['販売売上税抜']) || 0,
        expectedProfit: Number(item['粗利見込']) || 0,
        confirmedProfit: Number(item['粗利確定']) || 0,
        referralSales: Number(item['紹介料売上']) || 0,
        referralProfit: Number(item['紹介料利益']) || 0,
        relatedCase: item['関連案件'],
        memo: item['メモ']
      };
    }),
    cashouts: cashouts.map(function(item) {
      return {
        id: item.id,
        dealId: item.deal_id,
        occurredOn: normalizeVehicleSalesDate_(item['発生日']),
        flowType: item['資金区分'],
        flowDirection: item['入出金'],
        vehicleName: item['車両'],
        caseLabel: item['案件'],
        counterpartyType: item['相手先区分'],
        counterpartyName: item['相手先名'],
        appraisalAmount: Number(item['査定額']) || 0,
        purchaseAmount: Number(item['仕入額']) || 0,
        loanBalance: Number(item['残債額']) || 0,
        loanPaymentAmount: Number(item['残債等支払額']) || 0,
        cashMovementAmount: Number(item['資金移動額']) || 0,
        scheduledOn: normalizeVehicleSalesDate_(item['予定日']),
        moneyLane: item['資金レイヤー'],
        revenueTarget: item['収益対象'],
        profitTarget: item['利益対象'],
        relatedCase: item['関連案件'],
        progressNote: item['進行状況'],
        memo: item['メモ']
      };
    }),
    recognitions: recognitions.map(function(item) {
      return {
        id: item.id,
        dealId: item.deal_id,
        recognizedOn: normalizeVehicleSalesDate_(item['計上日']),
        recognitionType: item['計上種別'],
        salesType: item['売上区分'],
        salesAmountTaxEx: Number(item['売上金額税抜']) || 0,
        profitAmountTaxEx: Number(item['利益金額税抜']) || 0,
        confirmationRule: item['確定条件'],
        linkedParty: item['連携先'],
        memo: item['メモ']
      };
    }),
    progressLogs: progressLogs.map(function(item) {
      return {
        id: item.id,
        dealId: item.deal_id,
        loggedOn: normalizeVehicleSalesDate_(item['記録日']),
        activityKind: item['記録区分'],
        activityPhase: item['工程区分'],
        counterpartyType: item['相手先区分'],
        counterpartyName: item['相手先名'],
        summary: item['内容'],
        nextActionOn: normalizeVehicleSalesDate_(item['次回予定日']),
        nextAction: item['次回予定'],
        activityStatus: item['完了状況'],
        progressUpdate: item['案件進捗更新'],
        inventoryUpdate: item['在庫状態更新'],
        memo: item['メモ']
      };
    })
  });

  if (deals.some(function(item) {
    return !sanitizeVehicleSalesText_(item['案件番号'])
      || !sanitizeVehicleSalesText_(item['現在所有者区分'])
      || !sanitizeVehicleSalesText_(item['保管先区分'])
      || !sanitizeVehicleSalesText_(item['所有権スキーム'])
      || !sanitizeVehicleSalesText_(item['コンクエスト精算方式']);
  })) {
    replaceVehicleSalesSheetValues_(
      ss.getSheetByName(VEHICLE_SALES_APP.sheets.deals),
      VEHICLE_SALES_APP.headers.deals,
      payload.deals.map(function(item) {
        return [
          item.id,
          item.caseNumber,
          item.caseName,
          item.brand,
          item.vehicleName,
          item.vehicleKey,
          item.sourceType,
          item.sourceName,
          item.ownerType,
          item.ownerName,
          item.custodyType,
          item.custodyName,
          item.buyerType,
          item.buyerName,
          item.ownershipScheme,
          item.settlementMode,
          item.dealType,
          item.progress,
          item.inventoryStage,
          item.recognitionRule,
          item.loanSettlement,
          item.caseDate,
          item.orderDate,
          item.registrationPlanDate,
          item.registrationDate,
          item.saleAmountTaxIn,
          item.saleAmountTaxEx,
          item.expectedProfit,
          item.confirmedProfit,
          item.referralSales,
          item.referralProfit,
          item.relatedCase,
          item.memo,
          new Date()
        ];
      })
    );
  }

  if (cashouts.some(function(item) { return !sanitizeVehicleSalesText_(item['資金レイヤー']); })) {
    replaceVehicleSalesSheetValues_(
      ss.getSheetByName(VEHICLE_SALES_APP.sheets.cashouts),
      VEHICLE_SALES_APP.headers.cashouts,
      payload.cashouts.map(function(item) {
        return [
          item.id,
          item.dealId,
          item.occurredOn,
          item.flowType,
          item.flowDirection,
          item.vehicleName,
          item.caseLabel,
          item.counterpartyType,
          item.counterpartyName,
          item.appraisalAmount,
          item.purchaseAmount,
          item.loanBalance,
          item.loanPaymentAmount,
          item.cashMovementAmount,
          item.scheduledOn,
          item.moneyLane,
          item.revenueTarget,
          item.profitTarget,
          item.relatedCase,
          item.progressNote,
          item.memo,
          new Date()
        ];
      })
    );
  }

  rebuildVehicleSalesDerivedSheets_(ss, payload);
  applyVehicleSalesInputValidations_(ss);
  return payload;
}

function readVehicleSalesSheetObjects_(sheet) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) {
    return [];
  }

  const values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  const headers = values[0].map(function(header) {
    return String(header || '').trim();
  });

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

function normalizeVehicleSalesDate_(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, VEHICLE_SALES_APP.timezone, 'yyyy-MM-dd');
  }
  const text = String(value).trim();
  if (!text) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(text)) {
    return text.replace(/\//g, '-').replace(/-(\d)(?!\d)/g, '-0$1');
  }
  return text;
}

function sanitizeVehicleSalesPayload_(payload) {
  const source = payload && typeof payload === 'object' ? payload : {};
  const progressLogs = sanitizeVehicleSalesProgressLogs_(source.progressLogs);
  const deals = applyVehicleSalesProgressUpdates_(
    assignVehicleSalesCaseNumbers_(sanitizeVehicleSalesDeals_(source.deals)),
    progressLogs
  );

  return {
    spreadsheetUrl: String(source.spreadsheetUrl || ''),
    appUrl: String(source.appUrl || ''),
    options: VEHICLE_SALES_APP.defaults,
    deals: applyVehicleSalesStructuralDefaults_(deals),
    cashouts: applyVehicleSalesCashoutDefaults_(sanitizeVehicleSalesCashouts_(source.cashouts)),
    recognitions: sanitizeVehicleSalesRecognitions_(source.recognitions),
    progressLogs: progressLogs
  };
}

function sanitizeVehicleSalesDeals_(items) {
  return (Array.isArray(items) ? items : []).map(function(item) {
    const source = item && typeof item === 'object' ? item : {};
    return {
      id: sanitizeVehicleSalesId_(source.id),
      caseNumber: sanitizeVehicleSalesCaseNumber_(source.caseNumber),
      caseName: sanitizeVehicleSalesText_(source.caseName),
      brand: sanitizeVehicleSalesText_(source.brand),
      vehicleName: sanitizeVehicleSalesText_(source.vehicleName),
      vehicleKey: sanitizeVehicleSalesText_(source.vehicleKey),
      sourceType: sanitizeVehicleSalesEnum_(source.sourceType, VEHICLE_SALES_APP.defaults.sourceTypes),
      sourceName: sanitizeVehicleSalesText_(source.sourceName),
      ownerType: sanitizeVehicleSalesOptionalEnum_(source.ownerType, VEHICLE_SALES_APP.defaults.ownerTypes),
      ownerName: sanitizeVehicleSalesText_(source.ownerName),
      custodyType: sanitizeVehicleSalesOptionalEnum_(source.custodyType, VEHICLE_SALES_APP.defaults.custodyTypes),
      custodyName: sanitizeVehicleSalesText_(source.custodyName),
      buyerType: sanitizeVehicleSalesEnum_(source.buyerType, VEHICLE_SALES_APP.defaults.buyerTypes),
      buyerName: sanitizeVehicleSalesText_(source.buyerName),
      ownershipScheme: sanitizeVehicleSalesOptionalEnum_(source.ownershipScheme, VEHICLE_SALES_APP.defaults.ownershipSchemes),
      settlementMode: sanitizeVehicleSalesOptionalEnum_(source.settlementMode, VEHICLE_SALES_APP.defaults.settlementModes),
      dealType: sanitizeVehicleSalesEnum_(source.dealType, VEHICLE_SALES_APP.defaults.dealTypes),
      progress: sanitizeVehicleSalesEnum_(source.progress, VEHICLE_SALES_APP.defaults.progress),
      inventoryStage: sanitizeVehicleSalesEnum_(source.inventoryStage, VEHICLE_SALES_APP.defaults.inventoryStages),
      recognitionRule: sanitizeVehicleSalesEnum_(source.recognitionRule, VEHICLE_SALES_APP.defaults.recognitionRules),
      loanSettlement: sanitizeVehicleSalesEnum_(source.loanSettlement, VEHICLE_SALES_APP.defaults.loanFlags),
      caseDate: sanitizeVehicleSalesDateInput_(source.caseDate),
      orderDate: sanitizeVehicleSalesDateInput_(source.orderDate),
      registrationPlanDate: sanitizeVehicleSalesDateInput_(source.registrationPlanDate),
      registrationDate: sanitizeVehicleSalesDateInput_(source.registrationDate),
      saleAmountTaxIn: sanitizeVehicleSalesNumber_(source.saleAmountTaxIn),
      saleAmountTaxEx: sanitizeVehicleSalesNumber_(source.saleAmountTaxEx),
      expectedProfit: sanitizeVehicleSalesNumber_(source.expectedProfit),
      confirmedProfit: sanitizeVehicleSalesNumber_(source.confirmedProfit),
      referralSales: sanitizeVehicleSalesNumber_(source.referralSales),
      referralProfit: sanitizeVehicleSalesNumber_(source.referralProfit),
      relatedCase: sanitizeVehicleSalesText_(source.relatedCase),
      memo: sanitizeVehicleSalesText_(source.memo)
    };
  }).filter(function(item) {
    return item.caseName || item.vehicleName || item.vehicleKey || item.sourceName || item.buyerName;
  });
}

function sanitizeVehicleSalesCashouts_(items) {
  return (Array.isArray(items) ? items : []).map(function(item) {
    const source = item && typeof item === 'object' ? item : {};
    return {
      id: sanitizeVehicleSalesId_(source.id),
      dealId: sanitizeVehicleSalesId_(source.dealId),
      occurredOn: sanitizeVehicleSalesDateInput_(source.occurredOn),
      flowType: sanitizeVehicleSalesEnum_(source.flowType, VEHICLE_SALES_APP.defaults.flowTypes),
      flowDirection: sanitizeVehicleSalesEnum_(source.flowDirection, VEHICLE_SALES_APP.defaults.flowDirections),
      vehicleName: sanitizeVehicleSalesText_(source.vehicleName),
      caseLabel: sanitizeVehicleSalesText_(source.caseLabel),
      counterpartyType: sanitizeVehicleSalesEnum_(source.counterpartyType, VEHICLE_SALES_APP.defaults.counterpartyTypes),
      counterpartyName: sanitizeVehicleSalesText_(source.counterpartyName),
      appraisalAmount: sanitizeVehicleSalesNumber_(source.appraisalAmount),
      purchaseAmount: sanitizeVehicleSalesNumber_(source.purchaseAmount),
      loanBalance: sanitizeVehicleSalesNumber_(source.loanBalance),
      loanPaymentAmount: sanitizeVehicleSalesNumber_(source.loanPaymentAmount),
      cashMovementAmount: sanitizeVehicleSalesNumber_(source.cashMovementAmount),
      scheduledOn: sanitizeVehicleSalesDateInput_(source.scheduledOn),
      moneyLane: sanitizeVehicleSalesOptionalEnum_(source.moneyLane, VEHICLE_SALES_APP.defaults.moneyLanes),
      revenueTarget: sanitizeVehicleSalesEnum_(source.revenueTarget, VEHICLE_SALES_APP.defaults.targetFlags),
      profitTarget: sanitizeVehicleSalesEnum_(source.profitTarget, VEHICLE_SALES_APP.defaults.targetFlags),
      relatedCase: sanitizeVehicleSalesText_(source.relatedCase),
      progressNote: sanitizeVehicleSalesText_(source.progressNote),
      memo: sanitizeVehicleSalesText_(source.memo)
    };
  }).filter(function(item) {
    return item.dealId || item.vehicleName || item.caseLabel || item.counterpartyName || item.cashMovementAmount || item.purchaseAmount || item.loanPaymentAmount;
  });
}

function sanitizeVehicleSalesRecognitions_(items) {
  return (Array.isArray(items) ? items : []).map(function(item) {
    const source = item && typeof item === 'object' ? item : {};
    return {
      id: sanitizeVehicleSalesId_(source.id),
      dealId: sanitizeVehicleSalesId_(source.dealId),
      recognizedOn: sanitizeVehicleSalesDateInput_(source.recognizedOn),
      recognitionType: sanitizeVehicleSalesEnum_(source.recognitionType, VEHICLE_SALES_APP.defaults.recognitionTypes),
      salesType: sanitizeVehicleSalesEnum_(source.salesType, VEHICLE_SALES_APP.defaults.salesTypes),
      salesAmountTaxEx: sanitizeVehicleSalesNumber_(source.salesAmountTaxEx),
      profitAmountTaxEx: sanitizeVehicleSalesNumber_(source.profitAmountTaxEx),
      confirmationRule: sanitizeVehicleSalesText_(source.confirmationRule),
      linkedParty: sanitizeVehicleSalesText_(source.linkedParty),
      memo: sanitizeVehicleSalesText_(source.memo)
    };
  }).filter(function(item) {
    return item.dealId || item.recognitionType || item.salesAmountTaxEx || item.profitAmountTaxEx;
  });
}

function sanitizeVehicleSalesProgressLogs_(items) {
  return (Array.isArray(items) ? items : []).map(function(item) {
    const source = item && typeof item === 'object' ? item : {};
    return {
      id: sanitizeVehicleSalesId_(source.id),
      dealId: sanitizeVehicleSalesId_(source.dealId),
      loggedOn: sanitizeVehicleSalesDateInput_(source.loggedOn),
      activityKind: sanitizeVehicleSalesEnum_(source.activityKind, VEHICLE_SALES_APP.defaults.activityKinds),
      activityPhase: sanitizeVehicleSalesEnum_(source.activityPhase, VEHICLE_SALES_APP.defaults.activityPhases),
      counterpartyType: sanitizeVehicleSalesOptionalEnum_(source.counterpartyType, VEHICLE_SALES_APP.defaults.counterpartyTypes),
      counterpartyName: sanitizeVehicleSalesText_(source.counterpartyName),
      summary: sanitizeVehicleSalesText_(source.summary),
      nextActionOn: sanitizeVehicleSalesDateInput_(source.nextActionOn),
      nextAction: sanitizeVehicleSalesText_(source.nextAction),
      activityStatus: sanitizeVehicleSalesEnum_(source.activityStatus, VEHICLE_SALES_APP.defaults.activityStatuses),
      progressUpdate: sanitizeVehicleSalesOptionalEnum_(source.progressUpdate, VEHICLE_SALES_APP.defaults.progress),
      inventoryUpdate: sanitizeVehicleSalesOptionalEnum_(source.inventoryUpdate, VEHICLE_SALES_APP.defaults.inventoryStages),
      memo: sanitizeVehicleSalesText_(source.memo)
    };
  }).filter(function(item) {
    return item.dealId || item.loggedOn || item.summary || item.nextAction;
  });
}

function applyVehicleSalesProgressUpdates_(deals, progressLogs) {
  const dealMap = createVehicleSalesDealMap_(deals);
  const sortedLogs = (progressLogs || []).slice().sort(function(left, right) {
    return String(left.loggedOn || left.nextActionOn || '').localeCompare(String(right.loggedOn || right.nextActionOn || ''));
  });

  sortedLogs.forEach(function(item) {
    const deal = dealMap[item.dealId];
    if (!deal) {
      return;
    }
    if (item.progressUpdate) {
      deal.progress = item.progressUpdate;
    }
    if (item.inventoryUpdate) {
      deal.inventoryStage = item.inventoryUpdate;
    }
  });

  return deals || [];
}

function sanitizeVehicleSalesEnum_(value, allowed) {
  const text = sanitizeVehicleSalesText_(value);
  return allowed.indexOf(text) >= 0 ? text : (allowed[0] || '');
}

function sanitizeVehicleSalesOptionalEnum_(value, allowed) {
  const text = sanitizeVehicleSalesText_(value);
  if (!text) {
    return '';
  }
  return allowed.indexOf(text) >= 0 ? text : '';
}

function sanitizeVehicleSalesText_(value) {
  return String(value == null ? '' : value).trim();
}

function sanitizeVehicleSalesCaseNumber_(value) {
  return sanitizeVehicleSalesText_(value).toUpperCase();
}

function sanitizeVehicleSalesNumber_(value) {
  const text = String(value == null ? '' : value).replace(/,/g, '').trim();
  if (!text || text === '-') return 0;
  const numeric = Number(text);
  return isFinite(numeric) ? numeric : 0;
}

function sanitizeVehicleSalesDateInput_(value) {
  const text = normalizeVehicleSalesDate_(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}

function sanitizeVehicleSalesId_(value) {
  const text = sanitizeVehicleSalesText_(value);
  return text || Utilities.getUuid();
}

function assignVehicleSalesCaseNumbers_(deals) {
  const used = {};
  let maxSequence = 0;

  (deals || []).forEach(function(item) {
    const caseNumber = sanitizeVehicleSalesCaseNumber_(item.caseNumber);
    if (!caseNumber) {
      return;
    }
    used[caseNumber] = true;
    const match = caseNumber.match(/^VS-(\d{4})$/);
    if (match) {
      maxSequence = Math.max(maxSequence, Number(match[1]) || 0);
    }
    item.caseNumber = caseNumber;
  });

  (deals || []).forEach(function(item) {
    if (item.caseNumber) {
      return;
    }
    let nextNumber = '';
    do {
      maxSequence += 1;
      nextNumber = 'VS-' + ('0000' + maxSequence).slice(-4);
    } while (used[nextNumber]);
    item.caseNumber = nextNumber;
    used[nextNumber] = true;
  });

  return deals || [];
}

function applyVehicleSalesStructuralDefaults_(deals) {
  return (deals || []).map(function(item) {
    if (!item.ownershipScheme) {
      if (item.sourceType === '顧客買取' || item.sourceType === '顧客下取') {
        item.ownershipScheme = '顧客買取→コンクエスト名義';
      } else if (item.dealType === '紹介') {
        item.ownershipScheme = 'コンクエスト紹介';
      } else if (item.sourceType === '自社在庫') {
        item.ownershipScheme = '自社在庫';
      } else if (item.sourceType === '業者買取') {
        item.ownershipScheme = '業者仕入';
      } else {
        item.ownershipScheme = '通常';
      }
    }

    if (!item.settlementMode) {
      item.settlementMode = item.ownershipScheme === '顧客買取→コンクエスト名義' ? '月末相殺' : 'なし';
    }

    if (!item.ownerType) {
      if (item.ownershipScheme === '顧客買取→コンクエスト名義' || item.ownershipScheme === 'コンクエスト紹介') {
        item.ownerType = 'コンクエスト';
      } else if (item.sourceType === 'コンクエスト仕入') {
        item.ownerType = 'コンクエスト';
      } else if (item.sourceType === '自社在庫' || item.sourceType === '業者買取') {
        item.ownerType = 'BRIDGE';
      }
    }
    if (!item.ownerName && item.ownerType) {
      item.ownerName = item.ownerType === 'BRIDGE' ? 'BRIDGE' : item.ownerType;
    }

    if (!item.custodyType) {
      if (item.ownershipScheme === '顧客買取→コンクエスト名義' || item.sourceType === '自社在庫' || item.sourceType === '業者買取') {
        item.custodyType = 'BRIDGE';
      } else if (item.ownershipScheme === 'コンクエスト紹介') {
        item.custodyType = 'コンクエスト';
      }
    }
    if (!item.custodyName && item.custodyType) {
      item.custodyName = item.custodyType === 'BRIDGE' ? 'BRIDGE' : item.custodyType;
    }

    return item;
  });
}

function applyVehicleSalesCashoutDefaults_(cashouts) {
  return (cashouts || []).map(function(item) {
    if (!item.moneyLane) {
      if (item.flowType === '残債一括返済' || item.counterpartyType === 'ローン会社') {
        item.moneyLane = 'ローン会社向け';
      } else if ((item.flowType || '').indexOf('コンクエスト') >= 0 || item.counterpartyType === 'コンクエスト') {
        item.moneyLane = 'コンクエスト向け';
      } else if (item.flowType === '紹介料入金') {
        item.moneyLane = '紹介料';
      } else if (item.flowType === '売上入金') {
        item.moneyLane = '売上回収';
      } else if (item.counterpartyType === '顧客' || item.flowType === '顧客買取支払' || item.flowType === '差額精算') {
        item.moneyLane = '顧客向け';
      } else if (item.counterpartyType === '業者') {
        item.moneyLane = '業者向け';
      } else {
        item.moneyLane = 'その他';
      }
    }
    return item;
  });
}

function resolveVehicleSalesCashAmount_(item) {
  const generic = Number(item.cashMovementAmount) || 0;
  if (generic) return generic;
  return (Number(item.purchaseAmount) || 0) + (Number(item.loanPaymentAmount) || 0);
}

function migrateVehicleSalesSheetNames_(ss) {
  Object.keys(VEHICLE_SALES_APP.sheets).forEach(function(key) {
    const targetName = VEHICLE_SALES_APP.sheets[key];
    if (ss.getSheetByName(targetName)) {
      return;
    }

    (VEHICLE_SALES_APP.legacySheets[key] || []).some(function(legacyName) {
      const legacySheet = ss.getSheetByName(legacyName);
      if (!legacySheet || legacyName === targetName) {
        return false;
      }
      legacySheet.setName(targetName);
      return true;
    });
  });
}

function arrangeVehicleSalesSheets_(ss) {
  const visibleKeys = VEHICLE_SALES_APP.visibleSheetKeys || [];
  VEHICLE_SALES_APP.sheetOrder.forEach(function(key, index) {
    const sheet = ss.getSheetByName(VEHICLE_SALES_APP.sheets[key]);
    if (!sheet) {
      return;
    }
    ss.setActiveSheet(sheet);
    ss.moveActiveSheet(index + 1);
    if (VEHICLE_SALES_APP.sheetColors[key]) {
      sheet.setTabColor(VEHICLE_SALES_APP.sheetColors[key]);
    }
  });
  const progressBoardSheet = ss.getSheetByName(VEHICLE_SALES_APP.sheets.progressBoard);
  if (progressBoardSheet) {
    progressBoardSheet.showSheet();
    ss.setActiveSheet(progressBoardSheet);
  }
  VEHICLE_SALES_APP.sheetOrder.forEach(function(key) {
    const sheet = ss.getSheetByName(VEHICLE_SALES_APP.sheets[key]);
    if (!sheet) {
      return;
    }
    if (visibleKeys.indexOf(key) >= 0) {
      sheet.showSheet();
    } else if (sheet.getSheetId() !== ss.getActiveSheet().getSheetId()) {
      sheet.hideSheet();
    }
  });
}

function renderVehicleSalesGuideSheet_(sheet) {
  const filter = sheet.getFilter();
  if (filter) {
    filter.remove();
  }

  sheet.clear();
  sheet.setHiddenGridlines(true);
  sheet.setFrozenRows(2);

  sheet.getRange('A1:F1').merge()
    .setValue('Vehicle Sales Control の見方')
    .setFontSize(18)
    .setFontWeight('bold')
    .setBackground('#315f72')
    .setFontColor('#ffffff');
  sheet.getRange('A2:F2').merge()
    .setValue('普段見るのは 01_案件進捗 / 02_キャッシュフロー / 03_利益一覧 / 04_所有権・在庫 / 05_支払い詳細 / 06_資金移動 です。90番台は内部用です。')
    .setBackground('#e9f2f6')
    .setWrap(true);

  const overviewRows = [
    ['見る順', 'シート名', '用途', 'このシートで判断すること'],
    ['1', VEHICLE_SALES_APP.sheets.progressBoard, '今動いている案件を把握', 'どの案件が生きていて、誰と何をやり取りし、次に何をすべきかを見る'],
    ['2', VEHICLE_SALES_APP.sheets.calendar, '日付ごとの入出金を確認', '今月どの日にいくら入るか、いくら出るか、差引がマイナスになる日はどこか'],
    ['3', VEHICLE_SALES_APP.sheets.dealSummary, '案件単位の全体像を確認', '車両管理キーつきで、仕入元、現在所有権、保管先、売却先、差引資金、利益をまとめて見る'],
    ['4', VEHICLE_SALES_APP.sheets.ownershipBoard, '所有権と所在を確認', '車両管理キーごとに、今その車が誰の所有物で、どこに保管され、どのスキームで動いているかを見る'],
    ['5', VEHICLE_SALES_APP.sheets.cashoutExport, '支払実務の一覧確認', '今日払うべき案件を案件番号つきで確認し、誰向けの金か、支払先、残債返済、進行状況を追う'],
    ['6', VEHICLE_SALES_APP.sheets.dealLedger, '案件の紐付けを1本で確認', '案件番号と車両管理キーごとに、進行記録・入出金・収益計上を時系列で追う'],
    ['7', VEHICLE_SALES_APP.sheets.deals, '案件の基本情報を入力・修正', '仕入元、現在所有者、保管先、売却先、スキーム'],
    ['8', VEHICLE_SALES_APP.sheets.progressLogs, 'やり取りや次回予定を入力', '査定、入金待ち、納車前整備、顧客連絡などの進行を残す'],
    ['9', VEHICLE_SALES_APP.sheets.cashouts, 'お金の動きを入力・修正', '顧客向け、コンクエスト向け、ローン会社向けなど、誰との金かを分けて入力する'],
    ['10', VEHICLE_SALES_APP.sheets.recognitions, '売上と利益の確定を入力・修正', 'いつ売上計上するか、紹介料なのか本体売上なのか']
  ];
  const overviewStartRow = 4;
  const ruleStartRow = overviewStartRow + overviewRows.length + 2;

  sheet.getRange(overviewStartRow, 1, overviewRows.length, overviewRows[0].length).setValues(overviewRows);
  sheet.getRange(overviewStartRow, 1, 1, overviewRows[0].length)
    .setBackground('#2f5f8f')
    .setFontColor('#ffffff')
    .setFontWeight('bold');

  const ruleRows = [
    ['入力手順', '内容'],
    ['1. ' + VEHICLE_SALES_APP.sheets.deals, 'まず ブランド / 車種 / 車両管理キー / 仕入元 / 現在所有者 / 保管先 / 売却先 を登録します。'],
    ['2. ' + VEHICLE_SALES_APP.sheets.progressLogs, '顧客とのやり取り、査定、支払い、新車入金、納車前整備、次回予定を追加します。必要なら同時に 案件進捗更新 / 在庫状態更新 を入れます。'],
    ['3. 同じ車の進捗更新', '下取り取得後に別の人へ売る場合でも、同じ車なら新規案件は作らず同じ案件を更新します。案件番号と車両管理キーは変えません。'],
    ['4. ' + VEHICLE_SALES_APP.sheets.cashouts, '現金が動く予定を登録します。ローン会社への返済は 資金区分=残債一括返済、資金レイヤー=ローン会社向け にします。'],
    ['5. ' + VEHICLE_SALES_APP.sheets.recognitions, '売上や利益が確定したタイミングだけ登録します。現金移動と利益確定は別です。']
  ];
  const noteStartRow = ruleStartRow + ruleRows.length + 2;
  sheet.getRange(ruleStartRow, 1, ruleRows.length, ruleRows[0].length).setValues(ruleRows);
  sheet.getRange(ruleStartRow, 1, 1, ruleRows[0].length)
    .setBackground('#315f72')
    .setFontColor('#ffffff')
    .setFontWeight('bold');

  const noteRows = [
    ['管理ルール', '使い方'],
    ['案件番号', 'その案件の管理番号です。商談や精算の単位を見ます。'],
    ['ブランド', 'アプリでは JLR新車 / JLR中古車 / Maserati / 他社＆業販 のプルダウンで登録します。'],
    ['車両管理キー', '同じ物理車両を追う共通キーです。車台番号下6桁や在庫管理番号など、同じ車なら同じ値を使います。'],
    ['進行記録', '顧客連絡、査定結果、入金待ち、納車前整備、次回予定を残す欄です。資金移動とは分けて管理します。'],
    ['仕入元名', 'その車がどこから来たかです。顧客、業者、コンクエストなど、車の出どころを入れます。'],
    ['売却先名', 'その車を最終的に誰へ売るかです。まだ未定なら未定のままで構いません。'],
    ['相手先名', '今回の入出金の相手です。顧客、コンクエスト、ローン会社、業者など、お金をやり取りする相手先を入れます。'],
    ['現在所有権 / 保管先', '法的に誰の車か と 物理的にどこにあるか を分けます。BRIDGE保管でもコンクエスト所有のケースを表せます。'],
    ['残債返済', '売上ではなく ' + VEHICLE_SALES_APP.sheets.cashouts + ' で管理します。予定日、支払先、進行状況まで残します。'],
    ['顧客買取→コンクエスト名義', '顧客とは BRIDGE が金をやり取りし、所有権はコンクエスト、保管はBRIDGE、コンクエストとの精算は月末相殺で管理します。'],
    ['差額精算', '顧客との受払は ' + VEHICLE_SALES_APP.sheets.cashouts + ' に入れます。利益の確定とは混ぜません。'],
    ['紹介料案件', '注文書金額と紹介料見込は分けます。紹介料が確定したら ' + VEHICLE_SALES_APP.sheets.recognitions + ' に入れます。']
  ];
  sheet.getRange(noteStartRow, 1, noteRows.length, noteRows[0].length).setValues(noteRows);
  sheet.getRange(noteStartRow, 1, 1, noteRows[0].length)
    .setBackground('#8e5b2d')
    .setFontColor('#ffffff')
    .setFontWeight('bold');

  sheet.getRange(overviewStartRow, 1, overviewRows.length, overviewRows[0].length).setWrap(true).setVerticalAlignment('top');
  sheet.getRange(ruleStartRow, 1, ruleRows.length, ruleRows[0].length).setWrap(true).setVerticalAlignment('top');
  sheet.getRange(noteStartRow, 1, noteRows.length, noteRows[0].length).setWrap(true).setVerticalAlignment('top');
  sheet.setColumnWidths(1, 1, 70);
  sheet.setColumnWidths(2, 1, 220);
  sheet.setColumnWidths(3, 1, 220);
  sheet.setColumnWidths(4, 1, 430);
  sheet.setColumnWidths(5, 2, 120);
}

function buildVehicleSalesCashCalendar_(payload) {
  const dealLabels = {};
  const daily = {};
  let totalOutflow = 0;
  let totalInflow = 0;
  let totalLoanOutflow = 0;
  let totalItems = 0;

  payload.deals.forEach(function(item) {
    dealLabels[item.id] = [item.caseNumber, item.vehicleKey, item.caseName, item.vehicleName, item.buyerName].filter(Boolean).join(' / ');
  });

  payload.cashouts.forEach(function(item) {
    const dateKey = item.scheduledOn || item.occurredOn;
    if (!dateKey) {
      return;
    }

    if (!daily[dateKey]) {
      daily[dateKey] = {
        outflow: 0,
        inflow: 0,
        loanOutflow: 0,
        items: []
      };
    }

    const amount = resolveVehicleSalesCashAmount_(item);
    const day = daily[dateKey];
    if (item.flowDirection === '入金') {
      day.inflow += amount;
      totalInflow += amount;
    } else {
      day.outflow += amount;
      totalOutflow += amount;
    }

    if (item.flowDirection === '出金' && isVehicleSalesLoanFlow_(item)) {
      const loanAmount = resolveVehicleSalesLoanPaymentAmount_(item);
      day.loanOutflow += loanAmount;
      totalLoanOutflow += loanAmount;
    }

    day.items.push({
      dealId: item.dealId || '',
      dealShortId: extractVehicleSalesDealCode_(dealLabels[item.dealId] || ''),
      direction: item.flowDirection,
      flowType: item.flowType,
      moneyLane: item.moneyLane || '',
      amount: amount,
      caseLabel: item.caseLabel || dealLabels[item.dealId] || item.vehicleName || '-',
      counterparty: item.counterpartyName || item.counterpartyType || '-',
      progressNote: item.progressNote || ''
    });
    totalItems += 1;
  });

  const dateKeys = Object.keys(daily).sort();
  return {
    daily: daily,
    dateKeys: dateKeys,
    monthKeys: buildVehicleSalesMonthKeys_(dateKeys),
    totals: {
      outflow: totalOutflow,
      inflow: totalInflow,
      loanOutflow: totalLoanOutflow,
      itemCount: totalItems
    }
  };
}

function renderVehicleSalesCalendarSheet_(sheet, calendarData) {
  const filter = sheet.getFilter();
  if (filter) {
    filter.remove();
  }

  sheet.clear();
  clearVehicleSalesBandings_(sheet);
  sheet.setHiddenGridlines(false);

  const totalColumns = 8;
  const lastDate = calendarData.dateKeys.length ? calendarData.dateKeys[calendarData.dateKeys.length - 1] : '';
  const firstDate = calendarData.dateKeys.length ? calendarData.dateKeys[0] : formatVehicleSalesDate_(new Date(), 'yyyy-MM-01');
  const title = calendarData.monthKeys.length > 1
    ? formatVehicleSalesMonthLabel_(calendarData.monthKeys[0]) + ' - ' + formatVehicleSalesMonthLabel_(calendarData.monthKeys[calendarData.monthKeys.length - 1]) + ' 資金繰り'
    : formatVehicleSalesMonthLabel_(calendarData.monthKeys[0] || firstDate) + ' 資金繰り';

  sheet.getRange(1, 1, 1, totalColumns).merge()
    .setValue(title)
    .setFontSize(15)
    .setFontWeight('bold')
    .setBackground('#111111')
    .setFontColor('#ffffff')
    .setHorizontalAlignment('center');

  const summaryHeaders = [['対象期間', '総入金', '総出金', '差引', '残債返済', '予定件数']];
  const summaryValues = [[
    firstDate + ' 〜 ' + lastDate,
    calendarData.totals.inflow,
    calendarData.totals.outflow,
    calendarData.totals.inflow - calendarData.totals.outflow,
    calendarData.totals.loanOutflow,
    calendarData.totals.itemCount
  ]];
  sheet.getRange(2, 1, 1, summaryHeaders[0].length).setValues(summaryHeaders)
    .setBackground('#d8e6ed')
    .setFontWeight('bold');
  sheet.getRange(3, 1, 1, summaryValues[0].length).setValues(summaryValues);
  sheet.getRange(3, 2, 1, 4).setNumberFormat('#,##0');
  sheet.getRange(2, 1, 2, summaryHeaders[0].length).setBorder(true, true, true, true, true, true, '#111111', SpreadsheetApp.BorderStyle.SOLID);
  sheet.getRange(2, 1, 2, summaryHeaders[0].length).setHorizontalAlignment('center').setVerticalAlignment('middle');
  sheet.setRowHeights(1, 3, 30);

  let row = 5;
  calendarData.monthKeys.forEach(function(monthKey) {
    row = renderVehicleSalesCalendarMonthBlock_(sheet, row, monthKey, calendarData);
  });

  sheet.setFrozenRows(3);
  sheet.setColumnWidths(1, 1, 88);
  sheet.setColumnWidths(2, 1, 50);
  sheet.setColumnWidths(3, 1, 120);
  sheet.setColumnWidths(4, 1, 340);
  sheet.setColumnWidths(5, 1, 120);
  sheet.setColumnWidths(6, 1, 340);
  sheet.setColumnWidths(7, 1, 120);
  sheet.setColumnWidths(8, 1, 260);
}

function renderVehicleSalesCalendarMonthBlock_(sheet, startRow, monthKey, calendarData) {
  const totalColumns = 8;
  const monthRows = buildVehicleSalesCalendarMonthRows_(calendarData, monthKey);
  const headerRow = startRow + 1;
  const dataStartRow = startRow + 2;
  const monthLabel = formatVehicleSalesMonthLabel_(monthKey);
  const headers = [['日付', '曜', '入金合計', '入金内容', '出金合計', '出金内容', '当日差引', 'メモ']];

  sheet.getRange(startRow, 1, 1, totalColumns).merge()
    .setValue(monthLabel)
    .setBackground('#f2f2f2')
    .setFontWeight('bold')
    .setHorizontalAlignment('left')
    .setFontSize(12);

  sheet.getRange(headerRow, 1, 1, totalColumns).setValues(headers).setFontWeight('bold');
  sheet.getRange(headerRow, 1, 1, 2).setBackground('#f3f3f3');
  sheet.getRange(headerRow, 3, 1, 2).setBackground('#4fa4de').setFontColor('#ffffff');
  sheet.getRange(headerRow, 5, 1, 2).setBackground('#e8d4ab').setFontColor('#111111');
  sheet.getRange(headerRow, 7, 1, 2).setBackground('#dfead9');
  sheet.getRange(headerRow, 1, 1, totalColumns).setWrap(false).setVerticalAlignment('middle').setHorizontalAlignment('center');

  const values = monthRows.map(function(item) { return item.values; });
  sheet.getRange(dataStartRow, 1, values.length, totalColumns).setValues(values);
  sheet.getRange(dataStartRow, 1, values.length, totalColumns).setVerticalAlignment('top');
  sheet.getRange(dataStartRow, 4, values.length, 1).setWrap(true);
  sheet.getRange(dataStartRow, 6, values.length, 1).setWrap(true);
  sheet.getRange(dataStartRow, 8, values.length, 1).setWrap(true);
  sheet.getRange(dataStartRow, 1, values.length, 3).setWrap(false);
  sheet.getRange(dataStartRow, 5, values.length, 3).setWrap(false);
  sheet.setRowHeights(dataStartRow, values.length, 40);
  if (values.length > 1) {
    sheet.getRange(dataStartRow, 1, values.length - 1, 1).setNumberFormat('m/d');
  }

  ['C', 'E', 'G'].forEach(function(column) {
    sheet.getRange(column + dataStartRow + ':' + column + (dataStartRow + values.length - 1)).setNumberFormat('#,##0;[Red]-#,##0');
  });

  monthRows.forEach(function(item, index) {
    const targetRow = dataStartRow + index;
    sheet.getRange(targetRow, 3).setBackground('#e8f3fb');
    sheet.getRange(targetRow, 5).setBackground('#f8efd8');
    if (item.isWeekend) {
      sheet.getRange(targetRow, 1, 1, 2).setBackground('#fbe4df').setFontColor('#a61c00').setFontWeight('bold');
    }
    if (item.values[6] !== '') {
      sheet.getRange(targetRow, 7).setBackground(item.values[6] >= 0 ? '#d9ead3' : '#f4cccc');
    }
    if (item.isTotal) {
      sheet.getRange(targetRow, 1, 1, totalColumns)
        .setBackground('#f3f3f3')
        .setFontWeight('bold')
        .setBorder(true, true, true, true, true, true, '#111111', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
    }
  });

  sheet.getRange(headerRow, 1, values.length + 1, totalColumns)
    .setBorder(true, true, true, true, true, true, '#111111', SpreadsheetApp.BorderStyle.SOLID);

  return dataStartRow + values.length + 2;
}

function buildVehicleSalesCalendarMonthRows_(calendarData, monthKey) {
  const detailSlots = VEHICLE_SALES_APP.calendarDetailSlots;
  const monthDate = new Date(monthKey + 'T00:00:00');
  const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
  const rows = [];
  let monthInflow = 0;
  let monthOutflow = 0;
  let monthLoanOutflow = 0;
  const monthItems = [];

  for (let dayNumber = 1; dayNumber <= daysInMonth; dayNumber += 1) {
    const dateKey = monthKey.slice(0, 8) + ('0' + dayNumber).slice(-2);
    const day = calendarData.daily[dateKey] || { outflow: 0, inflow: 0, loanOutflow: 0, items: [] };
    const inflows = day.items.filter(function(item) { return item.direction === '入金'; });
    const outflows = day.items.filter(function(item) { return item.direction === '出金'; });
    const memoParts = [];
    const values = [
      new Date(Number(dateKey.slice(0, 4)), Number(dateKey.slice(5, 7)) - 1, Number(dateKey.slice(8, 10))),
      formatVehicleSalesWeekday_(dateKey),
      day.inflow || 0,
      buildVehicleSalesCalendarDetailText_(inflows),
      day.outflow || 0,
      buildVehicleSalesCalendarDetailText_(outflows)
    ];

    if (inflows.length > detailSlots) {
      memoParts.push('入金 他' + (inflows.length - detailSlots) + '件');
    }
    if (outflows.length > detailSlots) {
      memoParts.push('出金 他' + (outflows.length - detailSlots) + '件');
    }
    if (day.loanOutflow) {
      memoParts.push('残債返済 ' + formatVehicleSalesAmount_(day.loanOutflow));
    }
    inflows.concat(outflows).forEach(function(item) {
      if (item.progressNote) {
        memoParts.push(item.progressNote);
      }
    });

    values.push((day.inflow || 0) - (day.outflow || 0));
    values.push(trimVehicleSalesCalendarText_(memoParts.join('\n'), 180));

    monthInflow += day.inflow;
    monthOutflow += day.outflow;
    monthLoanOutflow += day.loanOutflow;
    monthItems.push.apply(monthItems, day.items);

    rows.push({
      values: values,
      isWeekend: isVehicleSalesWeekend_(dateKey),
      isTotal: false
    });
  }

  rows.push({
    values: [
      formatVehicleSalesMonthLabel_(monthKey) + ' 合計',
      '',
      monthInflow,
      summarizeVehicleSalesCalendarItems_(monthItems.filter(function(item) { return item.direction === '入金'; })),
      monthOutflow,
      summarizeVehicleSalesCalendarItems_(monthItems.filter(function(item) { return item.direction === '出金'; })),
      monthInflow - monthOutflow,
      '残債返済合計 ' + formatVehicleSalesAmount_(monthLoanOutflow)
    ],
    isWeekend: false,
    isTotal: true
  });

  return rows;
}

function formatVehicleSalesExportSheet_(sheet) {
  if (!sheet || sheet.getLastRow() < 1) {
    return;
  }
  clearVehicleSalesBandings_(sheet);
  sheet.setHiddenGridlines(false);
  sheet.setFrozenRows(1);
  sheet.setRowHeight(1, 34);
  sheet.getRange(1, 1, 1, sheet.getLastColumn())
    .setBackground('#8e2f22')
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setWrap(false)
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  if (sheet.getLastRow() > 1) {
    sheet.autoResizeRows(2, sheet.getLastRow() - 1);
    sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn())
      .setVerticalAlignment('middle')
      .setHorizontalAlignment('left');
    sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).setNumberFormat('yyyy-mm-dd');
    sheet.getRange(2, 13, sheet.getLastRow() - 1, 5).setNumberFormat('#,##0;[Red]-#,##0');
    sheet.getRange(2, 5, sheet.getLastRow() - 1, 4).setWrap(true);
    sheet.getRange(2, 18, sheet.getLastRow() - 1, 5).setWrap(true);
    sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY);
  }
  var widths = [110, 130, 95, 125, 180, 150, 150, 150, 120, 120, 120, 170, 115, 95, 95, 95, 120, 180, 90, 90, 150, 220];
  widths.forEach(function(width, index) {
    sheet.setColumnWidth(index + 1, width);
  });
}

function formatVehicleSalesCashMovementSheet_(sheet) {
  if (!sheet || sheet.getLastRow() < 1) {
    return;
  }
  clearVehicleSalesBandings_(sheet);
  sheet.setHiddenGridlines(false);
  sheet.setFrozenRows(1);
  sheet.setRowHeight(1, 34);
  if (sheet.getLastRow() > 1) {
    sheet.autoResizeRows(2, sheet.getLastRow() - 1);
  }
  sheet.getRange(1, 1, 1, sheet.getLastColumn())
    .setBackground('#8e2f22')
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setWrap(false)
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn())
      .setVerticalAlignment('middle')
      .setHorizontalAlignment('left');
    sheet.getRange(2, 3, sheet.getLastRow() - 1, 1).setNumberFormat('yyyy-mm-dd');
    sheet.getRange(2, 14, sheet.getLastRow() - 1, 1).setNumberFormat('#,##0;[Red]-#,##0');
    sheet.getRange(2, 15, sheet.getLastRow() - 1, 1).setNumberFormat('yyyy-mm-dd');
    sheet.getRange(2, 10, sheet.getLastRow() - 1, 5).setNumberFormat('#,##0;[Red]-#,##0');
    sheet.getRange(2, 7, sheet.getLastRow() - 1, 3).setWrap(true);
    sheet.getRange(2, 19, sheet.getLastRow() - 1, 3).setWrap(true);
    sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY);
  }
  var widths = [110, 150, 105, 140, 90, 150, 180, 120, 170, 100, 100, 100, 110, 120, 105, 120, 90, 90, 160, 220, 220, 110];
  widths.forEach(function(width, index) {
    sheet.setColumnWidth(index + 1, width);
  });
}

function formatVehicleSalesSummarySheet_(sheet) {
  if (sheet.getLastRow() < 2) {
    return;
  }
  clearVehicleSalesBandings_(sheet);
  sheet.setHiddenGridlines(false);
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(2);
  sheet.setRowHeight(1, 34);
  if (sheet.getLastRow() > 1) {
    sheet.setRowHeights(2, sheet.getLastRow() - 1, 34);
  }
  sheet.getRange(1, 1, 1, sheet.getLastColumn())
    .setBackground('#2d6a6a')
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setWrap(false)
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn())
    .setVerticalAlignment('middle')
    .setHorizontalAlignment('left');
  sheet.getRange(2, 7, sheet.getLastRow() - 1, 2).setNumberFormat('#,##0;[Red]-#,##0');
  sheet.getRange(2, 10, sheet.getLastRow() - 1, 1).setNumberFormat('#,##0;[Red]-#,##0');
  sheet.getRange(2, 7, sheet.getLastRow() - 1, 1).setHorizontalAlignment('right');
  sheet.getRange(2, 8, sheet.getLastRow() - 1, 1).setHorizontalAlignment('right');
  sheet.getRange(2, 10, sheet.getLastRow() - 1, 1).setHorizontalAlignment('right');
  sheet.setColumnWidth(1, 95);
  sheet.setColumnWidth(2, 220);
  sheet.setColumnWidth(3, 230);
  sheet.setColumnWidth(4, 135);
  sheet.setColumnWidth(5, 160);
  sheet.setColumnWidth(6, 130);
  sheet.setColumnWidth(7, 120);
  sheet.setColumnWidth(8, 120);
  sheet.setColumnWidth(9, 320);
  sheet.setColumnWidth(10, 130);
  sheet.setColumnWidth(11, 150);
  sheet.setColumnWidth(12, 240);
  sheet.setColumnWidth(13, 220);
  sheet.getRange(2, 2, sheet.getLastRow() - 1, 1).setWrap(true);
  sheet.getRange(2, 3, sheet.getLastRow() - 1, 1).setWrap(true);
  sheet.getRange(2, 9, sheet.getLastRow() - 1, 1).setWrap(true);
  sheet.getRange(2, 12, sheet.getLastRow() - 1, 2).setWrap(true);
  sheet.autoResizeRows(2, sheet.getLastRow() - 1);
  if (sheet.getLastRow() > 2) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY);
  }
}

function formatVehicleSalesProgressBoardSheet_(sheet) {
  if (sheet.getLastRow() < 2) {
    return;
  }
  clearVehicleSalesBandings_(sheet);
  sheet.setHiddenGridlines(false);
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(2);
  sheet.setRowHeight(1, 34);
  if (sheet.getLastRow() > 1) {
    sheet.setRowHeights(2, sheet.getLastRow() - 1, 34);
  }
  sheet.getRange(1, 1, 1, sheet.getLastColumn())
    .setBackground('#425b8c')
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setWrap(false)
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  sheet.getRange(2, 9, sheet.getLastRow() - 1, 1).setNumberFormat('yyyy-mm-dd');
  sheet.getRange(2, 11, sheet.getLastRow() - 1, 1).setNumberFormat('yyyy-mm-dd');
  sheet.getRange(2, 13, sheet.getLastRow() - 1, 1).setNumberFormat('#,##0');
  sheet.getRange(2, 15, sheet.getLastRow() - 1, 2).setNumberFormat('#,##0;[Red]-#,##0');
  sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).setVerticalAlignment('middle').setHorizontalAlignment('left');
  sheet.setColumnWidth(1, 95);
  sheet.setColumnWidth(2, 210);
  sheet.setColumnWidth(3, 150);
  sheet.setColumnWidth(4, 95);
  sheet.setColumnWidth(5, 190);
  sheet.setColumnWidth(6, 135);
  sheet.setColumnWidth(7, 120);
  sheet.setColumnWidth(8, 120);
  sheet.setColumnWidth(9, 105);
  sheet.setColumnWidth(10, 260);
  sheet.setColumnWidth(11, 105);
  sheet.setColumnWidth(12, 240);
  sheet.setColumnWidth(13, 90);
  sheet.setColumnWidth(14, 240);
  sheet.setColumnWidth(15, 120);
  sheet.setColumnWidth(16, 130);
  sheet.setColumnWidth(17, 220);
  sheet.getRange(2, 2, sheet.getLastRow() - 1, 1).setWrap(true);
  sheet.getRange(2, 10, sheet.getLastRow() - 1, 1).setWrap(true);
  sheet.getRange(2, 12, sheet.getLastRow() - 1, 1).setWrap(true);
  sheet.getRange(2, 14, sheet.getLastRow() - 1, 1).setWrap(true);
  sheet.getRange(2, 17, sheet.getLastRow() - 1, 1).setWrap(true);
  sheet.autoResizeRows(2, sheet.getLastRow() - 1);
  if (sheet.getLastRow() > 2) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY);
  }
}

function formatVehicleSalesOwnershipSheet_(sheet) {
  if (sheet.getLastRow() < 2) {
    return;
  }
  clearVehicleSalesBandings_(sheet);
  sheet.setHiddenGridlines(false);
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(2);
  sheet.setRowHeight(1, 34);
  if (sheet.getLastRow() > 1) {
    sheet.setRowHeights(2, sheet.getLastRow() - 1, 34);
  }
  sheet.getRange(1, 1, 1, sheet.getLastColumn())
    .setBackground('#3f6b4f')
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setWrap(false)
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).setVerticalAlignment('middle').setHorizontalAlignment('left');
  sheet.setColumnWidth(1, 95);
  sheet.setColumnWidth(2, 210);
  sheet.setColumnWidth(3, 95);
  sheet.setColumnWidth(4, 180);
  sheet.setColumnWidth(5, 135);
  sheet.setColumnWidth(6, 170);
  sheet.setColumnWidth(7, 170);
  sheet.setColumnWidth(8, 170);
  sheet.setColumnWidth(9, 170);
  sheet.setColumnWidth(10, 170);
  sheet.setColumnWidth(11, 130);
  sheet.setColumnWidth(12, 120);
  sheet.setColumnWidth(13, 220);
  sheet.getRange(2, 2, sheet.getLastRow() - 1, 1).setWrap(true);
  sheet.getRange(2, 6, sheet.getLastRow() - 1, 5).setWrap(true);
  sheet.getRange(2, 13, sheet.getLastRow() - 1, 1).setWrap(true);
  sheet.autoResizeRows(2, sheet.getLastRow() - 1);
  if (sheet.getLastRow() > 2) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY);
  }
}

function formatVehicleSalesLedgerSheet_(sheet) {
  if (sheet.getLastRow() < 2) {
    return;
  }
  clearVehicleSalesBandings_(sheet);
  sheet.getRange(2, 10, sheet.getLastRow() - 1, 2).setNumberFormat('yyyy-mm-dd');
  sheet.getRange(2, 16, sheet.getLastRow() - 1, 3).setNumberFormat('#,##0;[Red]-#,##0');
  sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).setVerticalAlignment('middle');
  if (sheet.getLastRow() > 2) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).applyRowBanding(SpreadsheetApp.BandingTheme.INDIGO);
  }
}

function clearVehicleSalesBandings_(sheet) {
  sheet.getBandings().forEach(function(banding) {
    banding.remove();
  });
}

function collectVehicleSalesMonthlyTotals_(daily, monthKey) {
  return Object.keys(daily).filter(function(dateKey) {
    return dateKey.indexOf(monthKey.slice(0, 7)) === 0;
  }).reduce(function(result, dateKey) {
    result.outflow += daily[dateKey].outflow;
    result.inflow += daily[dateKey].inflow;
    return result;
  }, { outflow: 0, inflow: 0 });
}

function buildVehicleSalesCalendarNote_(dateKey, daySummary) {
  if (!daySummary) {
    return '';
  }
  const lines = [dateKey];
  daySummary.items.forEach(function(item) {
    lines.push('[' + item.direction + '] ' + item.flowType + ' / ' + item.caseLabel + ' / ' + item.counterparty + ' / ' + formatVehicleSalesAmount_(item.amount));
    if (item.progressNote) {
      lines.push('  進行状況: ' + item.progressNote);
    }
  });
  return lines.join('\n');
}

function summarizeVehicleSalesCalendarItems_(items) {
  const labels = items.slice(0, 3).map(function(item) {
    return item.flowType + ' ' + item.caseLabel;
  });
  if (items.length > 3) {
    labels.push('他 ' + (items.length - 3) + ' 件');
  }
  return labels.join(' / ');
}

function buildVehicleSalesCalendarDetailText_(items) {
  if (!items.length) {
    return '';
  }
  const lines = items.slice(0, 4).map(function(item) {
    return buildVehicleSalesCalendarItemLabel_(item) + ' ' + formatVehicleSalesAmount_(item.amount);
  });
  if (items.length > 4) {
    lines.push('他 ' + (items.length - 4) + ' 件');
  }
  return lines.join('\n');
}

function buildVehicleSalesMonthKeys_(dateKeys) {
  if (!dateKeys.length) {
    return [formatVehicleSalesDate_(new Date(), 'yyyy-MM-01')];
  }

  const monthKeys = [];
  let cursor = new Date(dateKeys[0].slice(0, 7) + '-01T00:00:00');
  const last = new Date(dateKeys[dateKeys.length - 1].slice(0, 7) + '-01T00:00:00');

  while (cursor.getTime() <= last.getTime()) {
    monthKeys.push(formatVehicleSalesDate_(cursor, 'yyyy-MM-01'));
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }
  return monthKeys;
}

function compareVehicleSalesSheetDates_(left, right) {
  const leftDate = left.scheduledOn || left.occurredOn || '';
  const rightDate = right.scheduledOn || right.occurredOn || '';
  return leftDate.localeCompare(rightDate)
    || (left.caseLabel || '').localeCompare(right.caseLabel || '')
    || (left.flowType || '').localeCompare(right.flowType || '');
}

function compareVehicleSalesDealsForSummary_(left, right) {
  const leftDate = left.caseDate || '';
  const rightDate = right.caseDate || '';
  return rightDate.localeCompare(leftDate)
    || (left.caseName || '').localeCompare(right.caseName || '', 'ja');
}

function compareVehicleSalesProgressLogs_(left, right) {
  const leftDate = left.loggedOn || left.nextActionOn || '';
  const rightDate = right.loggedOn || right.nextActionOn || '';
  return leftDate.localeCompare(rightDate)
    || (left.activityPhase || '').localeCompare(right.activityPhase || '')
    || (left.summary || '').localeCompare(right.summary || '');
}

function formatVehicleSalesDate_(date, pattern) {
  return Utilities.formatDate(date, VEHICLE_SALES_APP.timezone, pattern);
}

function formatVehicleSalesWeekday_(dateKey) {
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  const date = new Date(dateKey + 'T00:00:00');
  return weekdays[date.getDay()];
}

function formatVehicleSalesMonthLabel_(dateKey) {
  const date = new Date(String(dateKey).slice(0, 7) + '-01T00:00:00');
  return Utilities.formatDate(date, VEHICLE_SALES_APP.timezone, 'yyyy年M月');
}

function isVehicleSalesWeekend_(dateKey) {
  const weekday = new Date(dateKey + 'T00:00:00').getDay();
  return weekday === 0 || weekday === 6;
}

function buildVehicleSalesCalendarItemLabel_(item) {
  const baseLabel = item.caseLabel || item.counterparty || item.flowType || '-';
  const counterparty = item.counterparty && item.counterparty !== '-' ? item.counterparty : '';
  const suffix = item.flowType === '残債一括返済'
    ? '残債返済'
    : item.flowType;
  const parts = [item.dealShortId || '', baseLabel].filter(Boolean);
  if (item.moneyLane) {
    parts.push(item.moneyLane);
  }
  if (counterparty && baseLabel.indexOf(counterparty) === -1 && suffix === '残債返済') {
    parts.push(counterparty);
  }
  parts.push(suffix);
  return trimVehicleSalesCalendarText_(parts.join(' / '), 42);
}

function trimVehicleSalesCalendarText_(text, maxLength) {
  const normalized = String(text || '').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return normalized.slice(0, maxLength - 1) + '…';
}

function extractVehicleSalesDealCode_(label) {
  const match = String(label || '').match(/(VS-\d{4})/);
  return match ? match[1] : '';
}

function formatVehicleSalesAmount_(value) {
  return Utilities.formatString('¥%,d', Number(value) || 0);
}

function formatVehicleSalesCompactAmount_(value) {
  const amount = Number(value) || 0;
  const abs = Math.abs(amount);
  const prefix = amount < 0 ? '-' : '';
  if (abs >= 10000) {
    const man = abs / 10000;
    const rounded = Math.round(man * 10) / 10;
    return prefix + rounded + '万';
  }
  return prefix + Utilities.formatString('%,d', abs);
}

function buildVehicleSalesFlowSummaries_(payload) {
  const summaries = {};

  payload.deals.forEach(function(item) {
    summaries[item.id] = createVehicleSalesFlowSummary_(item.loanSettlement);
  });

  payload.recognitions.forEach(function(item) {
    const summary = summaries[item.dealId] || (summaries[item.dealId] = createVehicleSalesFlowSummary_('なし'));
    summary.sales += Number(item.salesAmountTaxEx) || 0;
    summary.profit += Number(item.profitAmountTaxEx) || 0;
  });

  payload.cashouts.forEach(function(item) {
    const summary = summaries[item.dealId] || (summaries[item.dealId] = createVehicleSalesFlowSummary_('なし'));
    const amount = resolveVehicleSalesCashAmount_(item);

    if (item.flowDirection === '入金') {
      summary.inflow += amount;
    } else {
      summary.outflow += amount;
    }

    if (item.flowType === '差額精算') {
      summary.adjustmentAmount += amount;
    }

    if (!isVehicleSalesLoanFlow_(item)) {
      return;
    }

    summary.loanSettlement = 'あり';
    pushUniqueVehicleSalesValue_(summary.loanCompanies, item.counterpartyName);
    if (item.scheduledOn && (!summary.loanScheduledOn || item.scheduledOn < summary.loanScheduledOn)) {
      summary.loanScheduledOn = item.scheduledOn;
    }
    if (item.progressNote) {
      summary.loanProgress = item.progressNote;
    }
    summary.loanPaymentAmount += resolveVehicleSalesLoanPaymentAmount_(item);
  });

  return summaries;
}

function buildVehicleSalesActivitySummaries_(payload) {
  const summaries = {};

  payload.deals.forEach(function(item) {
    summaries[item.id] = createVehicleSalesActivitySummary_();
  });

  (payload.progressLogs || []).slice().sort(compareVehicleSalesProgressLogs_).forEach(function(item) {
    const summary = summaries[item.dealId] || (summaries[item.dealId] = createVehicleSalesActivitySummary_());
    const loggedOn = item.loggedOn || item.nextActionOn || '';
    const lastSummary = [item.activityPhase, item.summary].filter(Boolean).join(' / ');
    if (loggedOn && (!summary.lastLoggedOn || loggedOn >= summary.lastLoggedOn)) {
      summary.lastLoggedOn = item.loggedOn || item.nextActionOn || '';
      summary.lastSummary = lastSummary;
      summary.memo = item.memo || summary.memo;
    }

    if (item.activityStatus !== '完了') {
      summary.openCount += 1;
      pushUniqueVehicleSalesValue_(summary.openItems, [item.activityPhase, item.nextAction || item.summary].filter(Boolean).join(' / '));
      if (item.nextActionOn && (!summary.nextActionOn || item.nextActionOn < summary.nextActionOn)) {
        summary.nextActionOn = item.nextActionOn;
        summary.nextAction = item.nextAction || item.summary || '';
      } else if (!summary.nextAction && (item.nextAction || item.summary)) {
        summary.nextAction = item.nextAction || item.summary || '';
      }
    }

    if (item.activityPhase === '下取支払' && item.activityStatus === '完了') {
      summary.tradePaymentDone = true;
    }
    if (item.activityPhase === '入金確認' && item.activityStatus === '完了') {
      summary.customerDepositDone = true;
    }
    if (item.activityPhase === '納車前整備' && item.activityStatus === '完了') {
      summary.preDeliveryDone = true;
    }
  });

  Object.keys(summaries).forEach(function(key) {
    summaries[key].openSummary = summaries[key].openItems.slice(0, 2).join(' / ');
  });

  return summaries;
}

function buildVehicleSalesProfitSummaries_(payload) {
  const summaries = {};

  payload.deals.forEach(function(item) {
    summaries[item.id] = createVehicleSalesProfitSummary_();
    pushUniqueVehicleSalesValue_(summaries[item.id].parties, item.sourceName);
    pushUniqueVehicleSalesValue_(summaries[item.id].parties, item.buyerName);
  });

  payload.cashouts.forEach(function(item) {
    const summary = summaries[item.dealId] || (summaries[item.dealId] = createVehicleSalesProfitSummary_());
    pushUniqueVehicleSalesValue_(summary.parties, item.counterpartyName);
  });

  (payload.progressLogs || []).forEach(function(item) {
    const summary = summaries[item.dealId] || (summaries[item.dealId] = createVehicleSalesProfitSummary_());
    pushUniqueVehicleSalesValue_(summary.parties, item.counterpartyName);
    if (item.memo) {
      summary.memo = item.memo;
    }
  });

  payload.recognitions.forEach(function(item) {
    const summary = summaries[item.dealId] || (summaries[item.dealId] = createVehicleSalesProfitSummary_());
    const typeLabel = summarizeVehicleSalesProfitType_(item);
    pushUniqueVehicleSalesValue_(summary.types, typeLabel);
    summary.breakdown.push(
      typeLabel + ': 売上 ' + formatVehicleSalesCompactAmount_(item.salesAmountTaxEx) + ' / 利益 ' + formatVehicleSalesCompactAmount_(item.profitAmountTaxEx)
    );
    pushUniqueVehicleSalesValue_(summary.parties, item.linkedParty);
    if (item.memo) {
      summary.memo = item.memo;
    }
  });

  Object.keys(summaries).forEach(function(key) {
    if (!summaries[key].types.length) {
      summaries[key].types.push('未確定');
    }
  });

  return summaries;
}

function createVehicleSalesProfitSummary_() {
  return {
    types: [],
    breakdown: [],
    parties: [],
    memo: ''
  };
}

function summarizeVehicleSalesProfitType_(item) {
  if (item.salesType === '紹介料売上' || item.recognitionType === '紹介料') {
    return '紹介料';
  }
  if (item.salesType === '本体売上' || item.recognitionType === '車両売上') {
    return '車両売上';
  }
  return item.recognitionType || item.salesType || 'その他';
}

function createVehicleSalesActivitySummary_() {
  return {
    lastLoggedOn: '',
    lastSummary: '',
    nextActionOn: '',
    nextAction: '',
    openCount: 0,
    openItems: [],
    openSummary: '',
    memo: '',
    tradePaymentDone: false,
    customerDepositDone: false,
    preDeliveryDone: false,
    loanCompletedAmount: 0
  };
}

function buildVehicleSalesDealLedgerRows_(payload) {
  const dealMap = createVehicleSalesDealMap_(payload.deals);
  const rows = [];

  payload.cashouts.forEach(function(item) {
    const deal = dealMap[item.dealId] || {};
    rows.push([
      item.dealId,
      deal.caseNumber || '',
      deal.caseName || item.caseLabel || '',
      item.vehicleName || deal.vehicleName || '',
      deal.vehicleKey || '',
      [deal.ownerType, deal.ownerName].filter(Boolean).join(' / '),
      [deal.custodyType, deal.custodyName].filter(Boolean).join(' / '),
      deal.progress || '',
      '資金移動',
      item.occurredOn,
      item.scheduledOn,
      item.moneyLane || '',
      item.flowDirection,
      item.flowType,
      [item.counterpartyType, item.counterpartyName].filter(Boolean).join(' / '),
      resolveVehicleSalesCashAmount_(item),
      '',
      '',
      item.revenueTarget,
      item.profitTarget,
      item.relatedCase,
      [item.progressNote, item.memo].filter(Boolean).join(' / ')
    ]);
  });

  payload.recognitions.forEach(function(item) {
    const deal = dealMap[item.dealId] || {};
    rows.push([
      item.dealId,
      deal.caseNumber || '',
      deal.caseName || '',
      deal.vehicleName || '',
      deal.vehicleKey || '',
      [deal.ownerType, deal.ownerName].filter(Boolean).join(' / '),
      [deal.custodyType, deal.custodyName].filter(Boolean).join(' / '),
      deal.progress || '',
      '収益計上',
      item.recognizedOn,
      item.recognizedOn,
      item.salesType === '紹介料売上' ? '紹介料' : '売上回収',
      '',
      item.recognitionType + ' / ' + item.salesType,
      item.linkedParty || '',
      '',
      item.salesAmountTaxEx,
      item.profitAmountTaxEx,
      '対象',
      '対象',
      deal.relatedCase || '',
      [item.confirmationRule, item.memo].filter(Boolean).join(' / ')
    ]);
  });

  (payload.progressLogs || []).forEach(function(item) {
    const deal = dealMap[item.dealId] || {};
    rows.push([
      item.dealId,
      deal.caseNumber || '',
      deal.caseName || '',
      deal.vehicleName || '',
      deal.vehicleKey || '',
      [deal.ownerType, deal.ownerName].filter(Boolean).join(' / '),
      [deal.custodyType, deal.custodyName].filter(Boolean).join(' / '),
      deal.progress || '',
      '進行記録',
      item.loggedOn,
      item.nextActionOn,
      '',
      '',
      [item.activityKind, item.activityPhase, item.summary].filter(Boolean).join(' / '),
      [item.counterpartyType, item.counterpartyName].filter(Boolean).join(' / '),
      '',
      '',
      '',
      '',
      '',
      '',
      [item.activityStatus, item.nextActionOn, item.nextAction, item.memo].filter(Boolean).join(' / ')
    ]);
  });

  return rows.sort(compareVehicleSalesLedgerRows_);
}

function createVehicleSalesDealMap_(deals) {
  return (deals || []).reduce(function(result, item) {
    result[item.id] = item;
    return result;
  }, {});
}

function compareVehicleSalesLedgerRows_(left, right) {
  if (left[0] !== right[0]) {
    return String(left[0] || '').localeCompare(String(right[0] || ''));
  }
  const leftDate = left[10] || left[9] || '';
  const rightDate = right[10] || right[9] || '';
  if (leftDate !== rightDate) {
    return String(leftDate).localeCompare(String(rightDate));
  }
  return String(left[8] || '').localeCompare(String(right[8] || ''));
}

function createVehicleSalesFlowSummary_(loanSettlement) {
  return {
    inflow: 0,
    outflow: 0,
    sales: 0,
    profit: 0,
    loanSettlement: loanSettlement === 'あり' ? 'あり' : 'なし',
    loanCompanies: [],
    loanScheduledOn: '',
    loanProgress: '',
    loanPaymentAmount: 0,
    adjustmentAmount: 0
  };
}

function isVehicleSalesLoanFlow_(item) {
  return item.flowType === '残債一括返済'
    || item.counterpartyType === 'ローン会社'
    || (Number(item.loanBalance) || 0) > 0
    || (Number(item.loanPaymentAmount) || 0) > 0;
}

function resolveVehicleSalesLoanPaymentAmount_(item) {
  return (Number(item.loanPaymentAmount) || 0) || (Number(item.cashMovementAmount) || 0);
}

function pushUniqueVehicleSalesValue_(items, value) {
  const normalized = String(value || '').trim();
  if (!normalized || items.indexOf(normalized) >= 0) {
    return;
  }
  items.push(normalized);
}
