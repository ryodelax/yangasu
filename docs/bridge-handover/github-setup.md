# ブリッジ案件 GitHub化メモ

## 最小構成

- 案件専用フォルダを作る
- その中に本番候補ファイルだけを寄せる
- `docs/bridge-handover/` も含めてGit管理する

## 初期化例

```bash
mkdir bridge-project
cd bridge-project
git init
```

## 最初に入れたいもの

- 実運用ファイル
- `docs/bridge-handover/`
- `.gitignore`
- `README.md`

## 最初のコミット例

```bash
git add .
git commit -m "chore: initialize bridge project handover baseline"
```

## GitHubで管理すると良い項目

- Issue:
  本番フロー確認、トリガー棚卸し、OCR再処理設計
- PR:
  仕様変更の理由、影響範囲、確認方法
- README:
  セットアップ、本番運用、触ってはいけない箇所

