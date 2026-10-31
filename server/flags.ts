const checks: Array<{ name: string; flag: string; secrets: string[] }> = [
  { name: "WhatsApp", flag: "FEATURE_WHATSAPP", secrets: ["WHATSAPP_TOKEN", "WHATSAPP_PHONE_NUMBER_ID"] },
  { name: "Email", flag: "FEATURE_EMAIL", secrets: ["RESEND_API_KEY", "EMAIL_FROM_DOMAIN"] },
  { name: "Google Business Profile API", flag: "FEATURE_GBP_API", secrets: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"] },
  { name: "Google Business Profile browser assist", flag: "FEATURE_GBP_BROWSER_ASSIST", secrets: [] },
  { name: "Shopify", flag: "FEATURE_SHOPIFY", secrets: ["SHOPIFY_API_KEY", "SHOPIFY_API_SECRET"] },
  { name: "WooCommerce", flag: "FEATURE_WOOCOMMERCE", secrets: ["WOOCOMMERCE_CONSUMER_KEY", "WOOCOMMERCE_CONSUMER_SECRET"] },
  { name: "Razorpay", flag: "FEATURE_RAZORPAY", secrets: ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"] },
  { name: "Shiprocket", flag: "FEATURE_SHIPROCKET", secrets: ["SHIPROCKET_EMAIL", "SHIPROCKET_PASSWORD"] },
  { name: "Search Console", flag: "FEATURE_SEARCH_CONSOLE", secrets: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"] },
  { name: "Google Sheets", flag: "FEATURE_CONNECTOR_SHEETS", secrets: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"] },
  { name: "Notion", flag: "FEATURE_CONNECTOR_NOTION", secrets: ["NOTION_CLIENT_ID", "NOTION_CLIENT_SECRET"] },
  { name: "Zoho CRM", flag: "FEATURE_CONNECTOR_ZOHO", secrets: ["ZOHO_CLIENT_ID", "ZOHO_CLIENT_SECRET"] },
  { name: "Odoo", flag: "FEATURE_CONNECTOR_ODOO", secrets: [] },
  { name: "Model answers", flag: "FEATURE_AI", secrets: ["OPENAI_API_KEY"] },
];

function present(name: string) {
  return Boolean(process.env[name]?.trim());
}

export function flagStatus() {
  return checks.map((check) => {
    const missing = check.secrets.filter((name) => !present(name));
    const enabled = process.env[check.flag] === "1";
    let state = "missing keys";
    if (check.secrets.length === 0 && !enabled) state = "off";
    else if (missing.length === 0 && !enabled) state = "keys present, flag off";
    else if (missing.length === 0 && enabled) state = "enabled";
    else if (check.name === "Google Business Profile browser assist") state = enabled ? "enabled" : "off";
    return { name: check.name, flag: check.flag, state, missing };
  });
}
