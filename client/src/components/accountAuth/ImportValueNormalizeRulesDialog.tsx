import { useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import DeleteIcon from "@mui/icons-material/Delete";
import { accountAuthApi } from "../../store/services/accountAuthApi";

type Props = {
  open: boolean;
  onClose: () => void;
};

// 対象にできる列（サーバー側 accountAuthDiff.ts の NORMALIZABLE_FIELDS と同じ
// 範囲。文字列型の列のみ。number/non_sync/delfgは型変換が要るため対象外）
const NORMALIZABLE_FIELD_OPTIONS: { key: string; label: string }[] = [
  { key: "accountName", label: "ユーザー名" },
  { key: "submission_date", label: "申込日" },
  { key: "regist_date", label: "登録日" },
  { key: "company_cd", label: "販社CD" },
  { key: "company_name", label: "販売会社" },
  { key: "company_store_cd", label: "販売会社店舗CD" },
  { key: "company_store_branch_num", label: "枝番" },
  { key: "store_cd", label: "販売店CD" },
  { key: "store_name", label: "販売店名" },
];

// Excel取り込みの差分比較前に「この列のこの値は、DB側ではこの値とみなす」
// という正規化ルールを管理する小さなダイアログ。
// 【社内限定機能】将来の権限管理実装時、客先ロールには見せないこと
// （docs/Excel取り込み_比較前値置換ルール.md参照）
export function ImportValueNormalizeRulesDialog({ open, onClose }: Props) {
  const { data: rows = [], isFetching } =
    accountAuthApi.useImportValueNormalizeRulesQuery();
  const [add, { isLoading: adding }] =
    accountAuthApi.useAddImportValueNormalizeRuleMutation();
  const [remove] = accountAuthApi.useRemoveImportValueNormalizeRuleMutation();

  const [field, setField] = useState(NORMALIZABLE_FIELD_OPTIONS[0].key);
  const [fromValue, setFromValue] = useState("");
  const [toValue, setToValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const fieldLabel = (key: string) =>
    NORMALIZABLE_FIELD_OPTIONS.find((o) => o.key === key)?.label ?? key;

  const handleAdd = async () => {
    setError(null);
    if (fromValue.trim() === "" || toValue.trim() === "") {
      setError("Excel側の値／DBとみなす値は空にできません");
      return;
    }
    try {
      await add({ field, fromValue, toValue }).unwrap();
      setFromValue("");
      setToValue("");
    } catch (err) {
      setError((err as Error).message ?? "追加に失敗しました");
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>比較前値置換ルールの管理</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          登録した列・値の組み合わせは、Excel取り込みの差分比較前に「DBとみなす値」へ正規化されます（差分として検出されなくなります）。
        </Typography>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          <TextField
            select
            label="対象列"
            size="small"
            value={field}
            onChange={(e) => setField(e.target.value)}
            sx={{ width: 180 }}
          >
            {NORMALIZABLE_FIELD_OPTIONS.map((o) => (
              <MenuItem key={o.key} value={o.key}>
                {o.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Excel側の値"
            size="small"
            value={fromValue}
            onChange={(e) => setFromValue(e.target.value)}
            fullWidth
          />
          <TextField
            label="DBとみなす値"
            size="small"
            value={toValue}
            onChange={(e) => setToValue(e.target.value)}
            fullWidth
          />
          <Button variant="contained" onClick={handleAdd} disabled={adding}>
            追加
          </Button>
        </Stack>
        <Stack spacing={1}>
          {rows.length === 0 && !isFetching && (
            <Typography variant="body2" color="text.secondary">
              登録されているルールはありません
            </Typography>
          )}
          {rows.map((r) => (
            <Stack
              key={r.id}
              direction="row"
              spacing={1}
              sx={{ alignItems: "center" }}
            >
              <Typography variant="body2" sx={{ width: 140 }}>
                {fieldLabel(r.field)}
              </Typography>
              <Typography variant="body2" sx={{ flex: 1 }}>
                {r.fromValue}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                →
              </Typography>
              <Typography variant="body2" sx={{ flex: 1 }}>
                {r.toValue}
              </Typography>
              <IconButton
                size="small"
                aria-label="削除"
                onClick={() => remove(r.id)}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Stack>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>閉じる</Button>
      </DialogActions>
    </Dialog>
  );
}
