import type { Page } from "@playwright/test";

import { BOOKS, expect, test, type TestLibrary } from "./support/fixtures";

/** Positions are fractions of the canvas (the bookcase layout is fixed for a small library). */
const BIN = { x: 0.76, y: 0.83 };

function seedBookcase(library: TestLibrary) {
  library.seed(BOOKS.pride, { shelf: "want-to-read" });
  library.seed(BOOKS.alice, { shelf: "want-to-read" });
  library.seed(BOOKS.dracula, { shelf: "reading" });
  library.seed(BOOKS.frankenstein, { shelf: "finished", rating: 5 });
}

async function openBookcase(page: Page) {
  await page.goto("/");
  const canvas = page.locator("main canvas");
  await expect(canvas).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(3000); // let the books drop into place
  return (await canvas.boundingBox())!;
}

/**
 * Moves the pointer over the canvas until a tooltip matching `hint` appears.
 * Books are in the left part of the canvas (`from`-`to`); the lamp is on the right.
 */
async function findBook(
  page: Page,
  box: { x: number; y: number; width: number; height: number },
  hint: RegExp,
  { from = 0.05, to = 0.6 } = {},
) {
  for (let y = 0.12; y < 0.95; y += 0.04) {
    for (let x = from; x < to; x += 0.012) {
      const point = { x: box.x + box.width * x, y: box.y + box.height * y };
      await page.mouse.move(point.x, point.y);
      if (await page.getByText(hint).isVisible()) return point;
    }
  }
  throw new Error(`Nothing with a tooltip matching ${hint} was found`);
}

test.describe("3D bookcase", () => {
  test("is the home page, and the old /shelves address still leads to it", async ({ page }) => {
    await page.goto("/shelves");

    await expect(page).toHaveURL(/:\d+\/$/);
    // The heading is only for screen readers: the bookcase speaks for itself.
    await expect(page.getByRole("heading", { level: 1, name: "My shelves" })).toBeAttached();
    const main = page.getByRole("navigation", { name: "Main" });
    await expect(main.getByRole("link", { name: "My shelves" })).toHaveAttribute("aria-current", "page");
    const tabs = page.getByRole("navigation", { name: "Shelves" });
    await expect(tabs.getByRole("link", { name: /Bookcase/ })).toHaveAttribute("aria-current", "page");
  });

  test("shows the shelved books; hovering shows a book's details and clicking opens it", async ({ page, library }) => {
    seedBookcase(library);
    const box = await openBookcase(page);
    await expect(page.getByRole("img", { name: "Bookcase with 4 books, a DNF bin and a reading lamp" })).toBeVisible();

    const point = await findBook(page, box, /Click to read/);
    const tooltip = page.locator("main strong").first();
    await expect(tooltip).not.toBeEmpty();
    const title = await tooltip.innerText();

    await page.mouse.click(point.x, point.y);

    await expect(page).toHaveURL(/\/read\/\d+/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  });

  test("the reading lamp beside the bin leads to Discover", async ({ page, library }) => {
    seedBookcase(library);
    const box = await openBookcase(page);

    const lamp = await findBook(page, box, /^Find your next book$/, { from: 0.7, to: 0.99 });
    await page.mouse.click(lamp.x, lamp.y);

    await expect(page).toHaveURL(/\/discover$/);
    await expect(page.getByRole("heading", { level: 1, name: "Find your next great read" })).toBeVisible();
  });

  test("a rated book shows its stars in the tooltip", async ({ page, library }) => {
    seedBookcase(library);
    const box = await openBookcase(page);

    await findBook(page, box, /^Finished · Click to read$/);

    await expect(page.locator('main [aria-label="Rated 5 out of 5"]')).toBeVisible();
  });

  test("dragging a book into the bin marks it “Did not finish”, and Undo puts it back", async ({ page, library }) => {
    seedBookcase(library);
    const box = await openBookcase(page);
    const from = await findBook(page, box, /Want to read · Click to read/);
    const title = await page.locator("main strong").first().innerText();
    const to = { x: box.x + box.width * BIN.x, y: box.y + box.height * BIN.y };

    await page.mouse.down();
    for (let step = 1; step <= 20; step++) {
      await page.mouse.move(from.x + ((to.x - from.x) * step) / 20, from.y + ((to.y - from.y) * step) / 20);
    }
    await page.mouse.up();

    const dragged = [BOOKS.pride, BOOKS.alice].find((book) => book.title === title)!;

    await expect(page.getByText(`Moved “${title}” to Did not finish.`)).toBeVisible();
    await expect.poll(() => library.get(dragged.id)?.shelf).toBe("dnf");

    await page.getByRole("button", { name: "Undo" }).click();
    await expect.poll(() => library.get(dragged.id)?.shelf).toBe("want-to-read");
  });
});
