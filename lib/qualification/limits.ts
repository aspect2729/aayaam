/** Meta Cloud API limits read from the current docs.
 * Reply buttons, updated 21 May 2026: up to 3 buttons, title max 20, body max 1024.
 * https://developers.facebook.com/docs/whatsapp/cloud-api/messages/interactive-reply-buttons-messages/
 * List messages, updated 2 Jul 2026: up to 10 rows in total, one list button, button title max 20.
 * https://developers.facebook.com/docs/whatsapp/cloud-api/messages/interactive-list-messages/
 * List row title max 24 and description max 72 are the Cloud API row limits published with that list reference.
 * Interactive messages are only valid inside the 24-hour customer-service window.
 * https://developers.facebook.com/docs/whatsapp/guides/interactive-messages/
 */
export const WHATSAPP_BUTTON_LIMIT = 3;
export const WHATSAPP_BUTTON_TITLE_MAX = 20;
export const WHATSAPP_LIST_ROW_LIMIT = 10;
export const WHATSAPP_LIST_ROW_TITLE_MAX = 24;
export const WHATSAPP_LIST_BUTTON_MAX = 20;
export const WHATSAPP_SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

export type InteractionMode = "buttons" | "list" | "text";

export function interactionFor(options: { id: string; title: string }[], windowOpen: boolean): InteractionMode {
  if (!windowOpen || options.length === 0) return "text";
  if (options.length <= WHATSAPP_BUTTON_LIMIT && options.every((option) => option.title.length <= WHATSAPP_BUTTON_TITLE_MAX)) return "buttons";
  if (options.length <= WHATSAPP_LIST_ROW_LIMIT && options.every((option) => option.title.length <= WHATSAPP_LIST_ROW_TITLE_MAX)) return "list";
  return "text";
}

export function numberedOptions(options: { title: string }[]) {
  return options.map((option, index) => `${index + 1}. ${option.title}`).join("\n");
}
