import { BOOKS, expect, test } from "./support/fixtures";
import { cardTitled, chooseShelf } from "./support/ui";

test.describe("Finishing, ratings and reviews", () => {
  test("finishing a book asks for stars and a note, which then show on its card", async ({ page, library }) => {
    library.seed(BOOKS.pride, { shelf: "reading", lastPage: 44, pageCount: 133 });
    await page.goto("/shelves/reading");
    await expect(cardTitled(page, BOOKS.pride.title).getByText("Page 44 of 133 · 33%")).toBeVisible();

    await chooseShelf(cardTitled(page, BOOKS.pride.title), "Finished");

    // The prompt stays open even though the card leaves the Reading list.
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading")).toHaveText(`You finished “${BOOKS.pride.title}”!`);
    await expect(dialog.getByRole("button", { name: "Save" })).toBeDisabled();
    await dialog.locator("label").filter({ hasText: "4 stars" }).click();
    await expect(dialog.getByText("Really liked it", { exact: true })).toBeVisible();
    await dialog.getByLabel(/A short note/).fill("Witty, warm and sharp.");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toBeHidden();

    await page.goto("/shelves/finished");
    const card = cardTitled(page, BOOKS.pride.title);
    await expect(card.getByRole("img", { name: "Rated 4 out of 5" })).toBeVisible();
    await expect(card.getByText("Witty, warm and sharp.")).toBeVisible();
    // A finished book shows as complete, and starts again from page 1.
    await expect(card.getByText("✓ Completed · 133 pages · 100%")).toBeVisible();
    await expect(card.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
    await expect(card.getByRole("link", { name: "Read again" })).toHaveAttribute("href", /\?page=1$/);
    expect(library.get(BOOKS.pride.id)).toMatchObject({ shelf: "finished", rating: 4, review: "Witty, warm and sharp." });
  });

  test("“Not now” skips the review; it can be added and edited later from the card", async ({ page, library }) => {
    library.seed(BOOKS.frankenstein, { shelf: "reading" });
    await page.goto("/shelves/reading");
    await chooseShelf(cardTitled(page, BOOKS.frankenstein.title), "Finished");
    await page.getByRole("dialog").getByRole("button", { name: "Not now" }).click();

    await page.goto("/shelves/finished");
    const card = cardTitled(page, BOOKS.frankenstein.title);
    await card.getByRole("button", { name: "Rate this book" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading")).toHaveText(`Your review of “${BOOKS.frankenstein.title}”`);
    await dialog.locator("label").filter({ hasText: "5 stars" }).click();
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(card.getByRole("img", { name: "Rated 5 out of 5" })).toBeVisible();

    // Editing starts from the saved rating; removing it brings back "Rate this book".
    await card.getByRole("button", { name: /^Edit/ }).click();
    await expect(dialog.getByRole("radio", { name: /^5 stars/ })).toBeChecked();
    await dialog.getByRole("button", { name: "Remove rating" }).click();
    await expect(card.getByRole("button", { name: "Rate this book" })).toBeVisible();
    expect(library.get(BOOKS.frankenstein.id)?.rating).toBeNull();
  });

  test("Escape closes the review dialog without saving", async ({ page, library }) => {
    library.seed(BOOKS.alice, { shelf: "finished" });
    await page.goto("/shelves/finished");

    await cardTitled(page, BOOKS.alice.title).getByRole("button", { name: "Rate this book" }).click();
    await page.getByRole("dialog").locator("label").filter({ hasText: "2 stars" }).click();
    await page.keyboard.press("Escape");

    await expect(page.getByRole("dialog")).toBeHidden();
    expect(library.get(BOOKS.alice.id)?.rating).toBeNull();
  });
});
