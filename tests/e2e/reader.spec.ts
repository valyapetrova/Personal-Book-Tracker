import { BOOKS, expect, test } from "./support/fixtures";
import { cardTitled } from "./support/ui";

const pageSections = "section[data-page]:visible";

test.describe("Reader", () => {
  test("opening a book that is on no shelf puts it on Reading", async ({ page, library }) => {
    await page.goto(`/read/${BOOKS.alice.id}`);

    await expect(page.locator(pageSections).first()).toBeVisible({ timeout: 60_000 });
    await expect.poll(() => library.get(BOOKS.alice.id)?.shelf).toBe("reading");
    await expect(page.locator("main header").getByRole("button", { name: /is on Reading/ })).toBeVisible();
  });

  test("books already on a shelf keep it when opened", async ({ page, library }) => {
    library.seed(BOOKS.alice, { shelf: "want-to-read" });
    await page.goto(`/read/${BOOKS.alice.id}`);
    await expect(page.locator(pageSections).first()).toBeVisible({ timeout: 60_000 });
    await page.waitForTimeout(1500);

    expect(library.get(BOOKS.alice.id)?.shelf).toBe("want-to-read");
  });

  test("scrolling loads more pages, and the page reached is remembered", async ({ page, library }) => {
    library.seed(BOOKS.pride, { shelf: "reading" });
    await page.goto(`/read/${BOOKS.pride.id}`);
    const pageInput = page.getByRole("spinbutton", { name: "Page", exact: true });
    await expect(pageInput).toHaveValue("1", { timeout: 60_000 });
    // The page selector sits above the book text.
    expect((await pageInput.boundingBox())!.y).toBeLessThan((await page.locator(pageSections).first().boundingBox())!.y);
    const loadedAtStart = await page.locator(pageSections).count();

    for (let i = 0; i < 8; i++) {
      await page.mouse.wheel(0, 3000);
      await page.waitForTimeout(300);
    }

    await expect.poll(() => page.locator(pageSections).count()).toBeGreaterThan(loadedAtStart);
    const reached = Number(await pageInput.inputValue());
    expect(reached).toBeGreaterThan(1);
    await expect.poll(() => library.get(BOOKS.pride.id)?.lastPage, { timeout: 10_000 }).toBe(reached);

    // "Continue reading" brings the reader back to that page.
    await page.getByRole("link", { name: /Back to/ }).click();
    await cardTitled(page, BOOKS.pride.title).getByRole("link", { name: "Continue reading" }).click();
    await expect(pageInput).toHaveValue(String(reached));
  });

  test("jumping to the last page shows the end, where the book can be marked finished", async ({ page, library }) => {
    library.seed(BOOKS.frankenstein, { shelf: "reading" });
    await page.goto(`/read/${BOOKS.frankenstein.id}`);
    const pageInput = page.getByRole("spinbutton", { name: "Page", exact: true });
    await expect(pageInput).toHaveValue("1", { timeout: 60_000 });
    const lastPage = (await page.getByText(/^of \d+$/).first().innerText()).match(/\d+/)![0];

    await pageInput.fill(lastPage);
    await pageInput.press("Enter");

    await expect(page.getByText("The End", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Mark as finished" }).click();
    await expect(page.getByRole("dialog").getByRole("heading")).toHaveText(`You finished “${BOOKS.frankenstein.title}”!`);
    await page.getByRole("dialog").getByRole("button", { name: "Not now" }).click();
    await expect(page.getByText("On your “Finished” shelf")).toBeVisible();
    expect(library.get(BOOKS.frankenstein.id)?.shelf).toBe("finished");
  });

  test("shows “not found” for a book id that does not exist", async ({ page }) => {
    await page.goto("/read/not-a-number");
    await expect(page.getByText("Page not found")).toBeVisible();
  });
});
