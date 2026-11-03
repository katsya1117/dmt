import { useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import { accountAuthApi } from "../../store/services/accountAuthApi";

type Props = {
  open: boolean;
  onClose: () => void;
};

// 差分プレビューで「デフォルトで適用しない」アカウントNoを管理する小さな
// ダイアログ。AccountAuthFormDialogほどの複雑さ（RHF/Zod）は不要なので、
// シンプルなuseStateで実装する
export function ImportExcludeNumbersDialog({ open, onClose }: Props) {
  const { data: rows = [], isFetching } =
    accountAuthApi.useImportExcludeNumbersQuery();
  const [add, { isLoading: adding }] =
    accountAuthApi.useAddImportExcludeNumberMutation();
  const [remove] = accountAuthApi.useRemoveImportExcludeNumberMutation();

  const [numberInput, setNumberInput] = useState("");
  const [commentInput, setCommentInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async () => {
    setError(null);
    const number = Number(numberInput);
    if (numberInput.trim() === "" || !Number.isInteger(number)) {
      setError("No.は整数で入力してください");
      return;
    }
    if (rows.some((r) => r.number === number)) {
      setError(`No.${number}は既に登録されています`);
      return;
    }
    try {
      await add({ number, comment: commentInput.trim() || undefined }).unwrap();
      setNumberInput("");
      setCommentInput("");
    } catch (err) {
      setError((err as Error).message ?? "追加に失敗しました");
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>差分除外Noリストの管理</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          ここに登録したNo.は、差分プレビューで検出はされますが、デフォルトで適用チェックが外れます（グレーアウト表示）。
        </Typography>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          <TextField
            label="No."
            size="small"
            value={numberInput}
            onChange={(e) => setNumberInput(e.target.value)}
            sx={{ width: 120 }}
          />
          <TextField
            label="理由（任意）"
            size="small"
            value={commentInput}
            onChange={(e) => setCommentInput(e.target.value)}
            fullWidth
          />
          <Button variant="contained" onClick={handleAdd} disabled={adding}>
            追加
          </Button>
        </Stack>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
          {rows.length === 0 && !isFetching && (
            <Typography variant="body2" color="text.secondary">
              登録されているNo.はありません
            </Typography>
          )}
          {rows.map((r) => (
            <Chip
              key={r.id}
              label={r.comment ? `No.${r.number}（${r.comment}）` : `No.${r.number}`}
              size="small"
              onDelete={() => remove(r.id)}
            />
          ))}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>閉じる</Button>
      </DialogActions>
    </Dialog>
  );
}
