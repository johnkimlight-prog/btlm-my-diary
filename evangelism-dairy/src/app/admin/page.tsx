"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { 
  Card, Row, Col, Typography, Select, Table, Statistic, Spin, message, Tabs, Tag, Button 
} from "antd";
import { 
  TeamOutlined, ClockCircleOutlined, FireOutlined, PieChartOutlined, BarChartOutlined 
} from "@ant-design/icons";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from "recharts";
import dayjs from "dayjs";
import 'dayjs/locale/ko';

dayjs.locale('ko');

const { Title, Text } = Typography;
const { Option } = Select;

// 색상 팔레트 (차트용)
const COLORS = ['#1890ff', '#52c41a', '#fadb14', '#ff4d4f', '#722ed1', '#eb2f96'];

export default function AdminDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  
  // 전체 데이터 상태
  const [allMembers, setAllMembers] = useState<any[]>([]);
  const [allLogs, setAllLogs] = useState<any[]>([]);
  
  // 필터 상태
  const [selectedDept, setSelectedDept] = useState<string>("전체");
  const [selectedRegion, setSelectedRegion] = useState<string>("전체");

  useEffect(() => {
    checkAdminAndFetchData();
  }, []);

  // --- 새로 추가되는 데이터 패칭 헬퍼 함수 (1000개 제한 돌파) ---
  const fetchAllMembers = async () => {
    let allData: any[] = [];
    let page = 0;
    const pageSize = 1000;

    while (true) {
      const { data, error } = await supabase
        .from("members")
        .select("*")
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error || !data || data.length === 0) break;
      allData = [...allData, ...data];
      if (data.length < pageSize) break; // 1000개 미만이면 마지막 페이지
      page++;
    }
    return allData;
  };

  const fetchAllLogs = async () => {
    let allData: any[] = [];
    let page = 0;
    const pageSize = 1000;

    while (true) {
      const { data, error } = await supabase
        .from("activity_logs")
        .select(`*, members(name, member_no, department, region)`)
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error || !data || data.length === 0) break;
      allData = [...allData, ...data];
      if (data.length < pageSize) break;
      page++;
    }
    return allData;
  };

  // --- 기존 함수 업데이트 ---
  const checkAdminAndFetchData = async () => {
    setLoading(true);
    
    // 1. 현재 사용자 인증 확인
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    // 2. 관리자 권한 확인 (is_admin === true)
    const { data: me } = await supabase.from("members").select("is_admin").eq("id", user.id).single();
    if (!me || !me.is_admin) {
      message.error("관리자 권한이 없습니다. 메인 페이지로 이동합니다.");
      router.push("/");
      return;
    }

    // 3. 커스텀 함수(fetchAll...)를 활용하여 6,000명 이상의 데이터를 모두 가져옵니다.
    // Promise.all을 사용하여 두 가지 데이터를 동시에 병렬로 불러와 속도를 높입니다.
    const [allMembersData, allLogsData] = await Promise.all([
      fetchAllMembers(),
      fetchAllLogs()
    ]);

    // 4. 모두 모아진 데이터를 상태(State)에 저장합니다.
    setAllMembers(allMembersData);
    setAllLogs(allLogsData);
    
    setLoading(false);
  };

  // --- 시간 계산 헬퍼 함수 ---
  const getDurationHours = (start: string, end: string) => {
    const [sH, sM] = start.split(':').map(Number);
    const [eH, eM] = end.split(':').map(Number);
    let diffMins = (eH * 60 + eM) - (sH * 60 + sM);
    if (diffMins < 0) diffMins += 24 * 60;
    return Number((diffMins / 60).toFixed(1));
  };

  // --- 필터링 로직 ---
  const filteredMembers = allMembers.filter(m => {
    if (selectedDept !== "전체" && m.department !== selectedDept) return false;
    if (selectedRegion !== "전체" && m.region !== selectedRegion) return false;
    return true;
  });

  const filteredLogs = allLogs.filter(log => {
    // log.members 안에는 조인된 작성자의 정보가 들어있습니다.
    if (selectedDept !== "전체" && log.members?.department !== selectedDept) return false;
    if (selectedRegion !== "전체" && log.members?.region !== selectedRegion) return false;
    return true;
  });

  // --- 핵심 통계 (KPI) 계산 ---
  const totalMembersCount = filteredMembers.length;
  // 유니크 활동 성도 수 계산 (Set 활용)
  const activeMembersSet = new Set(filteredLogs.map(log => log.member_id));
  const activeMembersCount = activeMembersSet.size;
  // 재적 대비 활동률
  const activityRate = totalMembersCount === 0 ? 0 : ((activeMembersCount / totalMembersCount) * 100).toFixed(1);
  
  // 총 활동 시간 및 인당 평균 시간
  const totalActivityHours = filteredLogs.reduce((acc, log) => acc + getDurationHours(log.start_time, log.end_time), 0);
  const avgActivityTime = activeMembersCount === 0 ? 0 : (totalActivityHours / activeMembersCount).toFixed(1);

  // --- 요일별 활동자 수 평균 계산 ---
  const dayOfWeekCount = [0, 0, 0, 0, 0, 0, 0]; // 일, 월, 화, 수, 목, 금, 토
  const daysMap = ["일", "월", "화", "수", "목", "금", "토"];
  filteredLogs.forEach(log => {
    const day = dayjs(log.activity_date).day();
    dayOfWeekCount[day] += 1;
  });
  const dayOfWeekChartData = daysMap.map((day, idx) => ({ name: day, 활동건수: dayOfWeekCount[idx] }));

  // --- 활동 도구별 통계 (파이 차트용) ---
  const toolCountMap: any = {};
  filteredLogs.forEach(log => {
    toolCountMap[log.tool_used] = (toolCountMap[log.tool_used] || 0) + 1;
  });
  const toolChartData = Object.keys(toolCountMap).map(key => ({ name: key, value: toolCountMap[key] }));

  // --- 지역/부서별 활동률 순위 데이터 테이블 생성 ---
  const regionStats: any = {};
  filteredMembers.forEach(m => {
    const region = m.region || "미배정";
    if (!regionStats[region]) regionStats[region] = { region, total: 0, active: new Set(), totalHours: 0 };
    regionStats[region].total += 1;
  });
  filteredLogs.forEach(log => {
    const region = log.members?.region || "미배정";
    if (regionStats[region]) {
      regionStats[region].active.add(log.member_id);
      regionStats[region].totalHours += getDurationHours(log.start_time, log.end_time);
    }
  });

  const rankTableData = Object.values(regionStats).map((r: any) => ({
    key: r.region,
    region: r.region,
    total: r.total,
    activeCount: r.active.size,
    rate: r.total === 0 ? 0 : ((r.active.size / r.total) * 100).toFixed(1),
    totalHours: Number(r.totalHours.toFixed(1))
  })).sort((a: any, b: any) => b.rate - a.rate); // 활동률 기준 내림차순 정렬

  // --- 필터용 중복 제거 옵션 ---
  const uniqueDepts = Array.from(new Set(allMembers.map(m => m.department).filter(Boolean)));
  const uniqueRegions = Array.from(new Set(allMembers.map(m => m.region).filter(Boolean)));

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><Spin size="large" description="통계 데이터를 불러오는 중입니다..." /></div>;

  return (
    <div style={{ backgroundColor: '#f0f5fa', minHeight: '100vh', padding: '30px' }}>
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        
        {/* 헤더 및 필터 영역 */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: "10px" }}>
          <Title level={2} style={{ margin: 0, color: '#003eb3' }}><BarChartOutlined /> 관리자 통합 대시보드</Title>
          <div style={{ display: 'flex', gap: '15px' }}>
            <Select 
              size="large" 
              value={selectedDept} 
              onChange={setSelectedDept} 
              style={{ width: 150 }}
            >
              <Option value="전체">부서 전체</Option>
              {uniqueDepts.map(dept => <Option key={dept} value={dept}>{dept}</Option>)}
            </Select>
            <Select 
              size="large" 
              value={selectedRegion} 
              onChange={setSelectedRegion} 
              style={{ width: 150 }}
            >
              <Option value="전체">지역 전체</Option>
              {uniqueRegions.map(region => <Option key={region} value={region}>{region}</Option>)}
            </Select>
            <Button size="large" onClick={() => router.push("/")}>메인으로 가기</Button>
          </div>
        </div>

        {/* 최상단 핵심 KPI 카드 */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} md={6}>
            <Card style={{ borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
              <Statistic title="해당 소속 총 재적" value={totalMembersCount} suffix="명" prefix={<TeamOutlined style={{color: '#1890ff'}}/>} />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card style={{ borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
              <Statistic title="활동자 수 (누적)" value={activeMembersCount} suffix="명" prefix={<FireOutlined style={{color: '#fa541c'}}/>} />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card style={{ borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.05)", border: '1px solid #91d5ff', backgroundColor: '#e6f7ff' }}>
              <Statistic title="재적 대비 활동률" value={activityRate} suffix="%" valueStyle={{ color: '#096dd9', fontWeight: 'bold' }} />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card style={{ borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
              <Statistic title="인당 평균 활동시간" value={avgActivityTime} suffix="시간" prefix={<ClockCircleOutlined style={{color: '#52c41a'}}/>} />
            </Card>
          </Col>
        </Row>

        {/* 차트 영역 */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          {/* 요일별 활동 건수 */}
          <Col xs={24} lg={16}>
            <Card title="요일별 누적 활동 건수" style={{ borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.05)", height: '100%' }}>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dayOfWeekChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="활동건수" fill="#1890ff" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </Col>
          
          {/* 활동 도구 비율 */}
          <Col xs={24} lg={8}>
            <Card title={<><PieChartOutlined /> 사용 도구 통계</>} style={{ borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.05)", height: '100%' }}>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={toolChartData} cx="50%" cy="50%" outerRadius={100} label dataKey="value">
                    {toolChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          </Col>
        </Row>

        {/* 하단 상세 데이터 테이블 영역 (탭으로 구성) */}
        <Card style={{ borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
          <Tabs defaultActiveKey="rank">
            
            <Tabs.TabPane tab="지역별 활동률 순위" key="rank">
              <Table 
                dataSource={rankTableData} 
                pagination={{ pageSize: 10 }}
                columns={[
                  { title: '순위', key: 'index', render: (text, record, index) => <Text strong>{index + 1}위</Text> },
                  { title: '지역/조직명', dataIndex: 'region', key: 'region' },
                  { title: '총 인원(재적)', dataIndex: 'total', key: 'total', render: val => `${val}명` },
                  { title: '활동자 수', dataIndex: 'activeCount', key: 'activeCount', render: val => `${val}명` },
                  { title: '활동 시간 합계', dataIndex: 'totalHours', key: 'totalHours', render: val => `${val}시간` },
                  { title: '활동률 (%)', dataIndex: 'rate', key: 'rate', 
                    render: rate => (
                      <Tag color={Number(rate) >= 50 ? 'success' : (Number(rate) >= 30 ? 'warning' : 'default')}>
                        {rate}%
                      </Tag>
                    )
                  }
                ]}
              />
            </Tabs.TabPane>
            
            <Tabs.TabPane tab="전체 상세 활동 내역 (로우 데이터)" key="logs">
              <Table 
                dataSource={filteredLogs} 
                rowKey="id"
                pagination={{ pageSize: 10 }}
                expandable={{
                  expandedRowRender: record => (
                    <div style={{ margin: 0, padding: 15, backgroundColor: '#fafafa', border: '1px dashed #d9d9d9' }}>
                      <p><strong>상세 내용:</strong> {record.description || "기재된 상세 내용이 없습니다."}</p>
                      <p><strong>찾1:</strong> {record.find_1_count}명 / <strong>찾2:</strong> {record.find_2_count}명</p>
                    </div>
                  ),
                }}
                columns={[
                  { title: '활동 날짜', dataIndex: 'activity_date', key: 'activity_date', sorter: (a, b) => a.activity_date.localeCompare(b.activity_date) },
                  { title: '이름', dataIndex: ['members', 'name'], key: 'name', render: text => <Text strong>{text}</Text> },
                  { title: '고유번호', dataIndex: ['members', 'member_no'], key: 'member_no' },
                  { title: '소속', key: 'dept', render: (_, record) => `${record.members?.department || '-'} / ${record.members?.region || '-'}` },
                  { title: '활동 도구', dataIndex: 'tool_used', key: 'tool_used', render: tool => <Tag color="blue">{tool}</Tag> },
                  { title: '시간', key: 'time', render: (_, record) => `${record.start_time.slice(0,5)} ~ ${record.end_time.slice(0,5)}` },
                ]}
              />
            </Tabs.TabPane>

          </Tabs>
        </Card>
      </div>
    </div>
  );
}