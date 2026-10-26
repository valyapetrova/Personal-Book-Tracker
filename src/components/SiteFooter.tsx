import styles from "./SiteFooter.module.css";

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <p className="container">
        Books, covers and search from{" "}
        <a href="https://www.gutenberg.org" target="_blank" rel="noopener noreferrer">
          Project Gutenberg
        </a>
        .
      </p>
    </footer>
  );
}
