# Case Studio — PC履歴表示（マルチデバイス対応）

パソコンで実行している Case Studio の管理業務ダッシュボールを、スマホからもアクセスしてリアルタイムで履歴を共有できるようになりました。

## 📋 何が変わったか

**修正前：**
- 🖥️ パソコンと 📱 スマホの localStorage が独立
- 同じ localhost でもデバイスごとに異なるデータが表示される
- スマホから実行履歴が見えない

**修正後：**
- ✅ API サーバーでデータを一元管理
- ✅ パソコン・スマホから同じ localhost にアクセス
- ✅ すべてのデバイスで同じ実行履歴を表示
- ✅ JSON ファイルでデータを自動保存

## 🚀 使用方法

### 1. サーバーを起動

```bash
cd /path/to/yangasu
node case-studio-server.js
```

起動時のメッセージ：
```
🚀 Case Studio サーバーが起動しました！
📱 http://localhost:3000 でアクセスしてください
🖥️  パソコンとスマホから同じ URL でアクセスすると、データが同期されます
💾 データは .case-studio-data.json に保存されています
```

### 2. アクセス

**パソコン：**
```
http://localhost:3000
```

**スマホ（同じネットワーク内）：**
```
http://<パソコンのIPアドレス>:3000
```

例：
```
http://192.168.1.100:3000
```

### 3. データの確認

- 案件、文字起こし、フィードバック、進捗マイルストーンはすべてサーバー経由で同期
- 最近の活動（「進捗の平均」セクション）にパソコンとスマホの操作が表示される

## 📁 ファイル構成

```
yangasu/
├── case-studio-server.js      ← 新規：API サーバー
├── case-studio.html           ← 修正：API 対応版
└── .case-studio-data.json    ← 自動生成：データストア
```

## ⚙️ API エンドポイント

| メソッド | エンドポイント | 説明 |
|---------|--------------|------|
| GET | `/api/data` | 全データを取得 |
| POST | `/api/data` | データを保存 |
| POST | `/api/reset` | データをリセット |

## 💾 データ保存

- データは `.case-studio-data.json` に自動保存
- JSON 形式で全データを保持
- 初回起動時はサンプルデータで初期化

## 🔌 オフライン対応

API が利用できない場合は自動的に localStorage にフォールバック：
```javascript
// ブラウザの console で確認
localStorage.setItem('cs-api-base', 'http://localhost:3000');
```

## 📝 トラブルシューティング

### スマホからアクセスできない
- パソコンとスマホが同じネットワークに接続しているか確認
- パソコンのIPアドレスを確認：
  ```bash
  # macOS / Linux
  ifconfig | grep "inet "
  
  # Windows
  ipconfig
  ```

### データが同期されない
- ブラウザの console でエラーを確認
- サーバーが起動しているか確認：
  ```bash
  curl http://localhost:3000/api/data
  ```

### データをリセットしたい
- `.case-studio-data.json` を削除して再起動
- または API で：
  ```bash
  curl -X POST http://localhost:3000/api/reset
  ```

## 🔐 セキュリティ

- ローカルネットワーク内での使用を想定
- 本番環境では認証機能の追加を推奨
- 公開ネットワークでの使用は避けてください

## 🛠️ 開発情報

- **ランタイム：** Node.js（外部依存ゼロ）
- **ポート：** 3000（環境変数 PORT で変更可能）
- **ストレージ：** ファイルベース JSON

```bash
# ポートを変更して起動
PORT=8080 node case-studio-server.js
```
