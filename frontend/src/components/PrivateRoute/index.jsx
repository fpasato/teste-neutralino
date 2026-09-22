import { Navigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import styles from "./index.module.css";

/**
 * @param {object} props
 * @param {React.ReactNode} props.children
 * @param {string[]} [props.allowedRoles] - se informado, so libera acesso
 *   para attendants com role dentro dessa lista (ex: ["admin","supervisor"]).
 *   Se omitido, qualquer attendant logado e ativo passa.
 */
export function PrivateRoute({ children, allowedRoles }) {
  const { attendant, loading } = useAuth();

  if (loading) {
    return (
      <div className={styles.globalLoading}>
        <div className={styles.globalSpinner} />
      </div>
    );
  }

  if (!attendant || attendant.active === false) {
    return <Navigate to="/" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(attendant.role)) {
    return <Navigate to="/home" replace />;
  }

  return children;
}