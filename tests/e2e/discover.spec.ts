import { expect, test } from "./support/fixtures";
import { bookCards, search } from "./support/ui";

test.describe("Discover", () => {
  test("shows 20 popular books, four per row, each with cover, title and author", async ({ page }) => {
    await search(page, "");

    await expect(bookCards(page)).toHaveCount(20);
    const tops = await bookCards(page).evaluateAll((cards) =>
      cards.slice(0, 5).map((card) => Math.round(card.getBoundingClientRect().top)),
    );
    expect(new Set(tops.slice(0, 4)).size).toBe(1); // first four on one row
    expect(tops[4]).toBeGreaterThan(tops[0]); // fifth starts the next row

    const first = bookCards(page).first();
    await expect(first.locator("h3")).not.toBeEmpty();
    await expect(first.locator("img")).toHaveCount(1);
  });

  test("searches the catalogue by title or author", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("searchbox").fill("austen");
    await page.getByRole("searchbox").press("Enter");

    await expect(page).toHaveURL(/\?q=austen/);
    await expect(page.getByRole("heading", { level: 2, name: "Results for “austen”" })).toBeVisible({ timeout: 60_000 });
    await expect(bookCards(page).getByRole("heading", { name: "Pride and Prejudice" }).first()).toBeVisible();

    // The query stays in the search box after a reload.
    await page.reload();
    await expect(page.getByRole("searchbox")).toHaveValue("austen");
  });

  test("“Find more books” adds the next 20 below without jumping to the top", async ({ page }) => {
    await search(page, "");
    const firstTitle = await bookCards(page).first().locator("h3").innerText();
    const button = page.getByRole("button", { name: "Find more books" });
    await button.scrollIntoViewIfNeeded();
    const scrollBefore = await page.evaluate(() => window.scrollY);

    await button.click();

    await expect(bookCards(page)).toHaveCount(40, { timeout: 60_000 });
    await expect(page).toHaveURL(/count=40/);
    await expect(bookCards(page).first().locator("h3")).toHaveText(firstTitle);
    expect(Math.abs((await page.evaluate(() => window.scrollY)) - scrollBefore)).toBeLessThan(150);
  });

  test("explains when nothing matches", async ({ page }) => {
    await page.goto("/?q=zzqxnotabook");

    await expect(page.getByRole("heading", { name: "No books found for “zzqxnotabook”" })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("link", { name: "Back to popular books" })).toBeVisible();
  });
});
