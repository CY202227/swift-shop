import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="empty">
      <h1>404</h1>
      <p>页面不存在</p>
      <Link to="/" className="btn">
        回首页
      </Link>
    </div>
  );
}
