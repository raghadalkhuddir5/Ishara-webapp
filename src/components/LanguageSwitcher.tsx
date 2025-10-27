import { useI18n } from "../context/I18nContext";
import { FormControl, Select, MenuItem, Box } from "@mui/material";

const LanguageSwitcher = () => {
  const { locale, setLocale } = useI18n();

  const handleLanguageChange = (e: any) => {
    setLocale(e.target.value);
  };

  return (
    <Box sx={{ minWidth: 120 }}>
      <FormControl fullWidth size="small">
        <Select
          value={locale}
          onChange={handleLanguageChange}
          sx={{
            color: "inherit",
            "& .MuiSelect-icon": {
              color: "inherit",
            },
          }}
        >
          <MenuItem value="en">English</MenuItem>
          <MenuItem value="ar">العربية</MenuItem>
        </Select>
      </FormControl>
    </Box>
  );
};

export default LanguageSwitcher;