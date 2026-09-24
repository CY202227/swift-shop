import { useContext } from "react";
import { AuthContext } from "../auth";
import { fmtTime } from "../format";

export default function ProfilePage() {
  const { user } = useContext(AuthContext);
  if (!user) return null;

  return (
    <div className="auth-box wide">
      <h1>个人中心</h1>
      <table className="table">
        <tbody>
          <tr>
            <th>用户名</th>
            <td>{user.username}</td>
          </tr>
          <tr>
            <th>邮箱</th>
            <td>
              {user.email}
              {user.email_verified ? (
                <span className="badge paid">已验证</span>
              ) : (
                <span className="badge cancelled">未验证</span>
              )}
            </td>
          </tr>
          <tr>
            <th>角色</th>
            <td>{user.role === "admin" ? "管理员" : "用户"}</td>
          </tr>
          <tr>
            <th>注册时间</th>
            <td>{fmtTime(user.created_at)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
