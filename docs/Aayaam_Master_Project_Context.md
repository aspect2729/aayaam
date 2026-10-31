# Aayaam master project context

The owner-authored master file was not in this repository when this pass started. This file records the rules already enforced by the product and the one change this execution plan required. If the original master document is added later, it replaces this file, except the receipt rule below stays unless the owner removes it.

## Billing

There is no point of sale. There is no counter checkout, cash register, barcode billing, or parked cart.

E-commerce billing is only for an e-commerce business, and only from a connected order: invoice, tax, discount, payment status, allocation, refund, credit note, numbering, PDF, and history. A gym or an interior studio does not see that billing.

A service business may issue a **payment receipt** for a recorded membership or service payment. A receipt is not an e-commerce invoice, not a GST return, and not a bank settlement. Cash on a receipt is a book entry until a reference and settlement evidence exist.

## Money and messages

Money is stored in paise. A pending, initiated, or failed payment does not reduce what the books say is due. Nothing is shown as sent, published, settled, or completed unless the provider confirmed it. A missing credential is “Awaiting setup” or “Not connected”.

Demo data stays labeled demo and stays inside the demo workspaces.

## Roles

Owner, administrator, manager, salesperson, accountant, inventory manager, and marketing manager. The server enforces them. The signed-in name is the greeting when an account session exists. The unsigned app is the demo workspace.
