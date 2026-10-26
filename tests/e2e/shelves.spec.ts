import { BOOKS, expect, test } from "./support/fixtures";
import { bookCards, cardTitled, chooseShelf, expectShelf, search, shelfButton, tabCount } from "./support/ui";

test.describe("Shelves", () => {
  test("“Want to read” adds a book in one click, and it is saved", async ({ page, library }) => {
    await search(page, "austen");
    const card = cardTitled(page, "Pride and Prejudice");

    await shelfButton(card).click();

    await expectShelf(card, "Want to read");
    await expect.poll(() => library.get(BOOKS.pride.id)?.shelf).toBe("want-to-read");
    await page.reload();
    await expectShelf(cardTitled(page, "Pride and Prejudice"), "Want to read");
  });

  test("the dropdown offers every shelf and moves the book", async ({ page, library }) => {
    library.seed(BOOKS.pride, { shelf: "want-to-read" });
    await page.goto("/shelves/want-to-read");
    const card = cardTitled(page, BOOKS.pride.title);

    await card.getByRole("button", { name: /^Choose a shelf/ }).click();
    await expect(card.getByRole("menuitemradio")).toHaveText(["Want to read", "Reading", "Finished", "Did not finish"]);
    await expect(card.getByRole("menuitemradio", { name: "Want to read" })).toBeChecked();
    await page.keyboard.press("Escape");
    await expect(card.getByRole("menu")).toBeHidden();

    await chooseShelf(card, "Reading");

    await expect(page.getByText("Your “Want to read” shelf is empty")).toBeVisible();
    expect(library.get(BOOKS.pride.id)?.shelf).toBe("reading");
    expect(await tabCount(page, "Reading")).toBe(1);
    expect(await tabCount(page, "Want to read")).toBe(0);
  });

  test("“Did not finish” puts the book on the DNF tab", async ({ page, library }) => {
    library.seed(BOOKS.dracula, { shelf: "reading" });
    await page.goto("/shelves/reading");

    await chooseShelf(cardTitled(page, BOOKS.dracula.title), "Did not finish");

    await page.getByRole("navigation", { name: "Shelves" }).getByRole("link", { name: /DNF/ }).click();
    await expectShelf(cardTitled(page, BOOKS.dracula.title), "Did not finish");
    expect(library.get(BOOKS.dracula.id)?.shelf).toBe("dnf");
  });

  test("removing a book asks for confirmation first", async ({ page, library }) => {
    library.seed(BOOKS.alice, { shelf: "reading" });
    await page.goto("/shelves/reading");
    const card = cardTitled(page, BOOKS.alice.title);

    await card.getByRole("button", { name: "Remove from shelves" }).click();
    await card.getByRole("button", { name: "Cancel" }).click();
    expect(library.get(BOOKS.alice.id)).not.toBeNull();

    await card.getByRole("button", { name: "Remove from shelves" }).click();
    await card.getByRole("button", { name: "Remove", exact: true }).click();

    await expect(bookCards(page)).toHaveCount(0);
    expect(library.get(BOOKS.alice.id)).toBeNull();
  });

  test("the heart adds a book to Favorites, separately from its shelf", async ({ page, library }) => {
    library.seed(BOOKS.sherlock, { shelf: "reading" });
    await page.goto("/shelves/reading");
    const heart = cardTitled(page, BOOKS.sherlock.title).getByRole("button", { name: "Add to favorites" });

    await expect(heart).toHaveAttribute("aria-pressed", "false");
    await heart.click();
    await expect(cardTitled(page, BOOKS.sherlock.title).getByRole("button", { name: "In favorites" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await page.getByRole("navigation", { name: "Shelves" }).getByRole("link", { name: /Favorites/ }).click();
    await expect(cardTitled(page, BOOKS.sherlock.title)).toBeVisible();
    expect(library.get(BOOKS.sherlock.id)).toMatchObject({ shelf: "reading", isFavorite: true });
  });

  test("tabs show a live count for every shelf", async ({ page, library }) => {
    library.seed(BOOKS.pride, { shelf: "want-to-read" });
    library.seed(BOOKS.alice, { shelf: "reading" });
    library.seed(BOOKS.dracula, { shelf: "reading" });
    library.seed(BOOKS.frankenstein, { shelf: "finished", favorite: true });
    library.seed(BOOKS.sherlock, { shelf: "dnf" });
    await page.goto("/shelves/reading");

    expect(await tabCount(page, "Bookcase")).toBe(4); // the bin's DNF books are counted separately
    expect(await tabCount(page, "Want to read")).toBe(1);
    expect(await tabCount(page, "Reading")).toBe(2);
    expect(await tabCount(page, "Finished")).toBe(1);
    expect(await tabCount(page, "DNF")).toBe(1);
    expect(await tabCount(page, "Favorites")).toBe(1);
  });
});
