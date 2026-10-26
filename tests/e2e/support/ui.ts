import { expect, type Locator, type Page } from "@playwright/test";

/** Visible book cards. (Next.js keeps recently visited pages mounted but hidden.) */
export function bookCards(page: Page): Locator {
  return page.locator("main ul[role=list] > li article:visible");
}

export function cardTitled(page: Page, title: string): Locator {
  return bookCards(page).filter({ has: page.getByRole("heading", { level: 3, name: title, exact: true }) }).first();
}

/** The main shelf button of a card: "Want to read" (unshelved) or the current shelf. */
export function shelfButton(card: Locator): Locator {
  return card.getByRole("button", { name: /Change shelf$|to Want to read$/ });
}

export async function expectShelf(card: Locator, label: string) {
  await expect(shelfButton(card)).toHaveAccessibleName(new RegExp(`is on ${label}\\. Change shelf$`));
}

/** Picks a shelf from a card's "Want to read ▾" menu. */
export async function chooseShelf(card: Locator, label: string) {
  await card.getByRole("button", { name: /^Choose a shelf/ }).click();
  await card.getByRole("menuitemradio", { name: label }).click();
}

/** Opens Discover with a search and waits for results, retrying if Project Gutenberg is slow. */
export async function search(page: Page, query: string) {
  await page.goto(query ? `/?q=${encodeURIComponent(query)}` : "/");
  const heading = page.getByRole("heading", { level: 2, name: query ? `Results for “${query}”` : "Popular on Project Gutenberg" });
  for (let attempt = 0; attempt < 3; attempt++) {
    const retry = page.getByRole("button", { name: "Try again" });
    await expect(heading.or(retry)).toBeVisible({ timeout: 60_000 });
    if (await heading.isVisible()) return;
    await retry.click();
  }
  await expect(heading).toBeVisible();
}

/** The number in a My shelves tab, e.g. 3 for "Reading 3". */
export async function tabCount(page: Page, name: string): Promise<number> {
  const tab = page.getByRole("navigation", { name: "Shelves" }).getByRole("link", { name: new RegExp(name) });
  return Number((await tab.innerText()).match(/\d+/)?.[0]);
}
