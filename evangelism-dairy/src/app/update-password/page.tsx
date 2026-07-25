"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card, Form, Input, Button, message, Typography } from "antd";
import { LockOutlined } from "@ant-design/icons";

const { Title } = Typography;

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values: { password: string }) => {
    if (values.password === "000000") {
      message.error("초기 비밀번호(000000)는 다시 사용할 수 없습니다.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password: values.password
    });

    if (error) {
      message.error("비밀번호 변경에 실패했습니다. 다시 시도해 주세요.");
    } else {
      message.success("비밀번호가 성공적으로 변경되었습니다! 다시 로그인해 주세요.");
      await supabase.auth.signOut();
      router.push("/login");
    }
    
    setLoading(false);
  };

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", backgroundColor: "#f0f2f5" }}>
      <Card style={{ width: 400, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <Title level={4} style={{ margin: 0 }}>비밀번호 변경</Title>
          <p style={{ color: "#ff4d4f", marginTop: 8 }}>안전을 위해 초기 비밀번호를 변경해야 합니다.</p>
        </div>

        <Form name="update_password" onFinish={onFinish} layout="vertical">
          <Form.Item
            name="password"
            rules={[
              { required: true, message: "새 비밀번호를 입력해 주세요." },
              { min: 6, message: "비밀번호는 최소 6자리 이상이어야 합니다." } // Supabase 기본 최소 길이
            ]}
          >
            <Input.Password 
              prefix={<LockOutlined />} 
              placeholder="새 비밀번호 (6자리 이상)" 
              size="large" 
            />
          </Form.Item>

          <Form.Item
            name="confirm_password"
            dependencies={['password']}
            rules={[
              { required: true, message: "새 비밀번호를 한 번 더 입력해 주세요." },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('입력한 비밀번호가 일치하지 않습니다.'));
                },
              }),
            ]}
          >
            <Input.Password 
              prefix={<LockOutlined />} 
              placeholder="새 비밀번호 확인" 
              size="large" 
            />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block size="large" loading={loading}>
              비밀번호 변경 완료
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}