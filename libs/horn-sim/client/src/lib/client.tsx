import styles from "./client.module.css";

export function Client(): React.JSX.Element {
  return (
    <div className={styles["container"]}>
      <h1>Welcome to Client!</h1>
    </div>
  );
}

export default Client;
