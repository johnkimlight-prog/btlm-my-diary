"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { 
  Card, Table, Typography, Row, Col, Statistic, DatePicker, 
  Select, Button, Spin, ConfigProvider, App, Tabs, Upload, Modal, Form, Input, Checkbox, Tag
} from "antd";
import { 
  BarChartOutlined, UploadOutlined, SafetyCertificateOutlined, TeamOutlined, EditOutlined, FilterOutlined 
} from "@ant-design/icons";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from "recharts";
import dayjs from "dayjs";
import 'dayjs/locale/ko';
import koKR from 'antd/locale/ko_KR';
import * as XLSX from "xlsx";

// 💡 상수를 외부 파일에서 불러옵니다.
import { REGION_MAP, DEPARTMENT24_LIST, CENTER_LIST } from "@/constants";

dayjs.locale('ko');
const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Dragger } = Upload;
const MINT_COLOR = "#13c2c2"; 

export default function AdminPage() {
  const router = useRouter();
  const { message } = App.useApp();
  
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [myAdminRoles, setMyAdminRoles] = useState<any[]>([]);
  
  const [membersList, setMembersList] = useState<any[]>([]);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<any>(null);
  const [roleForm] = Form.useForm();
  
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([dayjs().startOf('year'), dayjs()]);
  const [selectedDept, setSelectedDept] = useState<string>("전체");

  const [filterDept, setFilterDept] = useState<string>("전체");
  const [filterRegion, setFilterRegion] = useState<string>("전체");
  const [filterTeam, setFilterTeam] = useState<string>("전체");
  const [filter24Dept, setFilter24Dept] = useState<string>("전체");
  const [filterCenter, setFilterCenter] = useState<string>("전체");

  useEffect(() => {
    checkAdminAndFetchData();
  }, [dateRange, selectedDept]);

  const getDurationHours = (start: string, end: string) => {
    if (!start || !end) return 0;
    const [sH, sM] = start.split(':').map(Number);
    const [eH, eM] = end.split(':').map(Number);
    let diffMins = (eH * 60 + eM) - (sH * 60 + sM);
    if (diffMins < 0) diffMins += 24 * 60;
    return diffMins / 60;
  };

  const formatMinsToString = (mins: number) => {
    if (!mins || mins === 0) return '0m';
    const h = Math.floor(mins / 60); const m = mins % 60;
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  };

  const fetchAllMembersCountBypass = async () => {
    let allData: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase.from("members").select(`*, member_roles(*)`).range(page * pageSize, (page + 1) * pageSize - 1).order("name");
      if (error || !data || data.length === 0) { hasMore = false; } 
      else { allData = [...allData, ...data]; if (data.length < pageSize) hasMore = false; else page++; }
    }
    return allData;
  };

  const fetchAllLogsCountBypass = async (startDateStr: string, endDateStr: string) => {
    let allLogs: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase.from("activity_logs").select(`*, members(name, member_no)`).gte("activity_date", startDateStr).lte("activity_date", endDateStr).order("activity_date", { ascending: false }).range(page * pageSize, (page + 1) * pageSize - 1);
      if (error || !data || data.length === 0) { hasMore = false; } 
      else { allLogs = [...allLogs, ...data]; if (data.length < pageSize) hasMore = false; else page++; }
    }
    return allLogs;
  };

  const checkAdminAndFetchData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }
    
    const { data: roles } = await supabase.from("member_roles").select("*").eq("member_id", user.id).eq("has_admin_access", true);
    if (!roles || roles.length === 0) { message.error("관리자 페이지 열람 권한이 없습니다."); router.push("/"); return; }
    setMyAdminRoles(roles);

    const startDateStr = dateRange[0].format("YYYY-MM-DD");
    const endDateStr = dateRange[1].format("YYYY-MM-DD");

    const fetchedLogs = await fetchAllLogsCountBypass(startDateStr, endDateStr);
    
    let filteredTab1Logs = fetchedLogs;
    if (selectedDept !== "전체") filteredTab1Logs = fetchedLogs.filter(l => l.dept_snapshot === selectedDept);
    setLogs(filteredTab1Logs);

    const fetchedMembers = await fetchAllMembersCountBypass();
    const memberStatsMap: Record<string, { mins: number; find1: number; find2: number; score: number }> = {};
    
    fetchedLogs.forEach(log => {
      const mId = log.member_id;
      if (!memberStatsMap[mId]) memberStatsMap[mId] = { mins: 0, find1: 0, find2: 0, score: 0 };
      const durationMins = Math.round(getDurationHours(log.start_time, log.end_time) * 60);
      const f1 = log.find_1_count || 0; const f2 = log.find_2_count || 0;
      memberStatsMap[mId].mins += durationMins; memberStatsMap[mId].find1 += f1; memberStatsMap[mId].find2 += f2;
      memberStatsMap[mId].score += (f1 * 0.5) + (f2 * 1.0);
    });

    const enrichedMembers = fetchedMembers.map(m => {
      const stat = memberStatsMap[m.id] || { mins: 0, find1: 0, find2: 0, score: 0 };
      return { ...m, totalMins: stat.mins, find1Count: stat.find1, find2Count: stat.find2, findScore: stat.score };
    });

    setMembersList(enrichedMembers);
    setLoading(false);
  };

  const getFilteredMembers = () => {
    return membersList.filter(m => {
      if (filterDept !== "전체" && m.department !== filterDept) return false;
      if (filterRegion !== "전체" && m.region !== filterRegion) return false;
      if (filterTeam !== "전체" && m.team !== filterTeam) return false;
      if (filter24Dept !== "전체" && m.dept_24 !== filter24Dept && m.department_24 !== filter24Dept) return false;
      if (filterCenter !== "전체" && m.center_church !== filterCenter && m.center !== filterCenter) return false;
      return true;
    });
  };

  const openRoleModal = (member: any) => {
    setEditingMember(member);
    const existingRole = member.member_roles && member.member_roles.length > 0 ? member.member_roles[0] : null;
    roleForm.setFieldsValue({
      dept_24: member.dept_24 || member.department_24 || undefined,
      center_church: member.center_church || member.center || undefined,
      role_name: existingRole?.role_name || "",
      target_dept: existingRole?.target_dept || undefined,
      target_region: existingRole?.target_region || "",
      target_team: existingRole?.target_team || "",
      target_sector: existingRole?.target_sector || "",
      has_admin_access: existingRole?.has_admin_access || false
    });
    setIsRoleModalOpen(true);
  };

  const handleRoleSubmit = async (values: any) => {
    try {
      await supabase.from('members').update({ dept_24: values.dept_24 || null, center_church: values.center_church || null }).eq('id', editingMember.id);
      const existingRole = editingMember.member_roles && editingMember.member_roles.length > 0 ? editingMember.member_roles[0] : null;
      
      if (!values.role_name) {
        if (existingRole) await supabase.from('member_roles').delete().eq('id', existingRole.id);
        message.success("사명이 해제되었으며 소속 정보가 수정되었습니다.");
      } else {
        const payload = {
          member_id: editingMember.id, role_name: values.role_name,
          target_dept: values.target_dept || null, target_region: values.target_region || null, target_team: values.target_team || null, target_sector: values.target_sector || null,
          has_admin_access: values.has_admin_access || false
        };
        if (existingRole) await supabase.from('member_roles').update(payload).eq('id', existingRole.id);
        else await supabase.from('member_roles').insert([payload]);
        message.success("사명 및 소속 정보가 성공적으로 수정되었습니다.");
      }
      setIsRoleModalOpen(false); checkAdminAndFetchData();
    } catch (err) { message.error("저장 중 오류가 발생했습니다."); }
  };

  const handleExcelUpload = async (file: File) => {
    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const rows: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

        if (rows.length === 0) throw new Error("엑셀에 데이터가 없습니다.");

        const { data: allMembers } = await supabase.from('members').select('id, member_no');
        const memberMap: Record<string, string> = {};
        allMembers?.forEach(m => { memberMap[m.member_no] = m.id; });

        const membersUpdatePayload: any[] = [];
        const rolesInsertPayload: any[] = [];
        const validUserIds: string[] = [];

        rows.forEach(row => {
          const mNo = row['고유번호']?.toString().trim();
          if (!mNo || !memberMap[mNo]) return;
          const uuid = memberMap[mNo];
          validUserIds.push(uuid);

          membersUpdatePayload.push({
            id: uuid, member_no: mNo,
            department: row['소속부서'] || "-", region: row['소속지역'] || "-", team: row['소속팀']?.toString() || "-", sector: row['소속구역']?.toString() || "-",
            dept_24: row['소속24부서'] || null, center_church: row['소속센터'] || null
          });

          if (row['사명명']) {
            rolesInsertPayload.push({
              member_id: uuid, role_name: row['사명명'],
              target_dept: row['관할부서'] || null, target_region: row['관할지역'] || null, target_team: row['관할팀']?.toString() || null, target_sector: row['관할구역']?.toString() || null,
              has_admin_access: row['관리자권한'] === 'O'
            });
          }
        });

        await supabase.from('members').upsert(membersUpdatePayload);
        if (validUserIds.length > 0) await supabase.from('member_roles').delete().in('member_id', validUserIds);
        if (rolesInsertPayload.length > 0) await supabase.from('member_roles').insert(rolesInsertPayload);

        message.success(`${validUserIds.length}명의 정보가 반영되었습니다!`); checkAdminAndFetchData();
      } catch (err: any) { message.error("오류가 발생했습니다. 양식을 확인해주세요."); } finally { setIsUploading(false); }
    };
    reader.readAsArrayBuffer(file); return false; 
  };

// 💡 [수정됨] 활동자 수 집계 및 찾기 점수 통합
  const calculateTotalStats = () => {
    let totalMins = 0;
    let totalFindScore = 0;
    const uniqueMembers = new Set(); // UUID 중복 제거용 집합

    logs.forEach(log => {
      totalMins += Math.round(getDurationHours(log.start_time, log.end_time) * 60);
      
      const f1 = log.find_1_count || 0;
      const f2 = log.find_2_count || 0;
      totalFindScore += (f1 * 0.5) + (f2 * 1.0); // 통합 점수 계산
      
      if (log.member_id) {
        uniqueMembers.add(log.member_id); // 활동자 UUID 수집
      }
    });

    return { 
      totalMins, 
      totalFindScore, 
      logCount: logs.length, 
      activeMemberCount: uniqueMembers.size // 고유 활동자 수 반환
    };
  };

  const generateChartData = () => {
    const deptMap: Record<string, number> = {};
    logs.forEach(log => {
      const dept = log.dept_snapshot || "미배정"; 
      const hours = getDurationHours(log.start_time, log.end_time);
      if (!deptMap[dept]) deptMap[dept] = 0; deptMap[dept] += hours;
    });
    return Object.keys(deptMap).map(key => ({ name: key, 시간: Number(deptMap[key].toFixed(1)) })).sort((a, b) => b.시간 - a.시간);
  };

  const stats = calculateTotalStats();
  const chartData = generateChartData();

  // 💡 테이블 placement 에러 수정 완료
  const columns = [
    { title: '이름', dataIndex: ['members', 'name'], key: 'name', width: 80, fixed: 'left' as const, sorter: (a: any, b: any) => (a.members?.name || '').localeCompare(b.members?.name || '') },
    { title: '고유번호', dataIndex: ['members', 'member_no'], key: 'member_no', width: 120, sorter: (a: any, b: any) => (a.members?.member_no || '').localeCompare(b.members?.member_no || '') },
    { title: '활동일', dataIndex: 'activity_date', key: 'activity_date', width: 110, sorter: (a: any, b: any) => a.activity_date.localeCompare(b.activity_date) },
    { title: '부서', dataIndex: 'dept_snapshot', key: 'dept', width: 90 },
    { title: '지역', dataIndex: 'region_snapshot', key: 'region', width: 100 },
    { title: '팀', dataIndex: 'team_snapshot', key: 'team', width: 70 },
    { title: '구역', dataIndex: 'sector_snapshot', key: 'sector', width: 70 },
    { title: '도구', dataIndex: 'tool_used', key: 'tool', width: 80 },
    { title: '활동 시간', key: 'time', width: 120, render: (_: any, record: any) => { const hrs = getDurationHours(record.start_time, record.end_time); return <span>{record.start_time.slice(0,5)}~{record.end_time.slice(0,5)} <br/><Text type="secondary">({hrs.toFixed(1)}h)</Text></span>; } },
    { title: '찾1', dataIndex: 'find_1_count', key: 'find1', width: 60, align: 'center' as const },
    { title: '찾2', dataIndex: 'find_2_count', key: 'find2', width: 60, align: 'center' as const },
    { title: '상세 내역', dataIndex: 'description', key: 'desc', ellipsis: true },
  ];

  const memberColumns = [
    { title: '이름', dataIndex: 'name', key: 'name', width: 90, fixed: 'left' as const, sorter: (a: any, b: any) => a.name.localeCompare(b.name) },
    { title: '고유번호', dataIndex: 'member_no', key: 'member_no', width: 120, sorter: (a: any, b: any) => a.member_no.localeCompare(b.member_no) },
    { title: '부서', dataIndex: 'department', key: 'department', width: 80, sorter: (a: any, b: any) => (a.department || '').localeCompare(b.department || '') },
    { title: '지역 / 센터', key: 'region', width: 110, sorter: (a: any, b: any) => (a.region || a.center_church || '').localeCompare(b.region || b.center_church || ''), render: (_: any, record: any) => { if (record.department === '교역') { return record.center_church || record.center || '-'; } return record.region || '-'; } },
    { title: '팀-구역', key: 'teamSector', width: 100, render: (_: any, record: any) => { if (record.department === '교역') return '-'; const t = record.team; const s = record.sector; if (t && t !== '-' && s) return `${t}-${s}`; if (s) return `${s}구역`; return '-'; } },
    { title: '소속 24부서', key: 'dept24', width: 110, render: (_: any, record: any) => record.dept_24 || record.department_24 || '-' },
    { title: '직책', key: 'role', width: 90, render: (_: any, record: any) => { const roles = record.member_roles || []; if (roles.length === 0) return <Text type="secondary">-</Text>; return <Tag color="cyan">{roles[0].role_name}</Tag>; } },
    { title: '활동시간', key: 'totalMins', width: 110, sorter: (a: any, b: any) => a.totalMins - b.totalMins, render: (_: any, record: any) => formatMinsToString(record.totalMins) },
    { title: '활동결과(점수)', key: 'findScore', width: 140, sorter: (a: any, b: any) => a.findScore - b.findScore, render: (_: any, record: any) => ( <span><Text strong style={{ color: MINT_COLOR }}>{record.findScore.toFixed(1)}점</Text> <Text type="secondary" style={{ fontSize: '0.8rem', marginLeft: 4 }}>(찾1:{record.find1Count}, 찾2:{record.find2Count})</Text></span> ) },
    { title: '관리', key: 'action', width: 90, align: 'center' as const, fixed: 'right' as const, render: (_: any, record: any) => ( <Button size="small" type="primary" ghost icon={<EditOutlined />} onClick={() => openRoleModal(record)}>수정</Button> ) },
  ];

  const renderCustomLabel = (props: any) => { const { x, y, width, value } = props; if (!value || value === 0) return null; return <text x={x + width / 2} y={y - 10} fill="#666" textAnchor="middle" fontSize={13}>{value}h</text>; };

  const filteredMembersData = getFilteredMembers();

  return (
    <ConfigProvider locale={koKR} theme={{ token: { colorPrimary: MINT_COLOR } }}>
      <div style={{ padding: '24px', backgroundColor: '#f0f2f5', minHeight: '100vh' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <Title level={3} style={{ margin: 0 }}>📊 전도 시스템 관리자 대시보드</Title>
            <Button onClick={() => router.push('/')}>내 다이어리로 돌아가기</Button>
          </div>

          <Tabs defaultActiveKey="1" items={[
            {
              key: "1", label: <><BarChartOutlined /> 활동 통계 및 내역</>, children: (
                <>
                  <Card styles={{ body: { padding: '16px 24px' } }} style={{ marginBottom: 24, borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
                    <Row gutter={[16, 16]} align="middle">
                      <Col xs={24} sm={12} md={8}>
                        <Text strong style={{ display: 'block', marginBottom: 8 }}>기간 필터</Text>
                        <RangePicker value={dateRange} onChange={(dates) => { if(dates && dates[0] && dates[1]) setDateRange([dates[0], dates[1]]) }} style={{ width: '100%' }} allowClear={false} />
                      </Col>
                      <Col xs={24} sm={12} md={6}>
                        <Text strong style={{ display: 'block', marginBottom: 8 }}>부서 스냅샷 필터</Text>
                        {/* 💡 상수를 활용한 부서 자동 렌더링 */}
                        <Select value={selectedDept} onChange={setSelectedDept} style={{ width: '100%' }}>
                          <Select.Option value="전체">전체 부서</Select.Option>
                          {Object.keys(REGION_MAP).filter(d => d !== "미배정").map(dept => (
                            <Select.Option key={dept} value={dept}>{dept}</Select.Option>
                          ))}
                        </Select>
                      </Col>
                      <Col xs={24} sm={24} md={10} style={{ textAlign: 'right' }}>
                        <Button type="primary" icon={<BarChartOutlined />} onClick={checkAdminAndFetchData} loading={loading}>
                          데이터 새로고침
                        </Button>
                      </Col>
                    </Row>
                  </Card>

                  {/* 💡 [수정됨] 보고 건수 -> 활동자 수 -> 총 활동 시간 -> 총 찾기(점수) 배치 */}
                  <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                    <Col xs={12} md={6}><Card styles={{ body: { padding: '20px' } }} style={{ borderRadius: 12 }}><Statistic title="총 보고 건수" value={stats.logCount} suffix="건" styles={{ content: { color: MINT_COLOR, fontWeight: 'bold' } }} /></Card></Col>
                    <Col xs={12} md={6}><Card styles={{ body: { padding: '20px' } }} style={{ borderRadius: 12 }}><Statistic title="활동자 수" value={stats.activeMemberCount} suffix="명" styles={{ content: { color: MINT_COLOR, fontWeight: 'bold' } }} /></Card></Col>
                    <Col xs={12} md={6}><Card styles={{ body: { padding: '20px' } }} style={{ borderRadius: 12 }}><Statistic title="총 활동 시간" value={formatMinsToString(stats.totalMins)} styles={{ content: { color: MINT_COLOR, fontWeight: 'bold' } }} /></Card></Col>
                    <Col xs={12} md={6}><Card styles={{ body: { padding: '20px' } }} style={{ borderRadius: 12 }}><Statistic title="총 찾기 (점수)" value={stats.totalFindScore.toFixed(1)} suffix="점" styles={{ content: { color: MINT_COLOR, fontWeight: 'bold' } }} /></Card></Col>
                  </Row>

                  <Card title="부서별 활동 시간 비교 (스냅샷 기준)" styles={{ body: { padding: '24px' } }} style={{ marginBottom: 24, borderRadius: 12 }}>
                    {loading ? <div style={{ textAlign: 'center', padding: '50px 0' }}><Spin /></div> : (
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={chartData} margin={{ top: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip formatter={(val: any) => `${val}시간`} />
                          <Bar dataKey="시간" fill={MINT_COLOR} radius={[4, 4, 0, 0]} barSize={40}><LabelList content={renderCustomLabel} /></Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </Card>

                  <Card title="상세 활동 내역 (영수증 데이터)" styles={{ body: { padding: '0' } }} style={{ borderRadius: 12, overflow: 'hidden' }}>
                    <Table columns={columns} dataSource={logs} rowKey="id" loading={loading} pagination={{ pageSize: 15, placement: ['bottomCenter'] }} scroll={{ x: 1000 }} size="middle" />
                  </Card>
                </>
              )
            },
            {
              key: "2", label: <><TeamOutlined /> 사명자 개별 관리</>, children: (
                <Card styles={{ body: { padding: '20px' } }} style={{ borderRadius: 12 }}>
                  <Card size="small" style={{ marginBottom: 16, backgroundColor: '#fafafa' }} styles={{ body: { padding: 12 } }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, gap: 6 }}>
                      <FilterOutlined style={{ color: MINT_COLOR }} />
                      <Text strong>성도 및 사명자 필터링</Text>
                      <Text type="secondary" style={{ fontSize: '0.85rem' }}>(조회 기간 내 활동 집계 반영)</Text>
                    </div>
                    <Row gutter={[8, 8]}>
                      <Col xs={24} sm={12} md={6}>
                        <Text type="secondary" style={{ fontSize: '0.8rem', display: 'block' }}>활동 집계 기간</Text>
                        <RangePicker value={dateRange} onChange={(dates) => { if(dates && dates[0] && dates[1]) setDateRange([dates[0], dates[1]]) }} style={{ width: '100%' }} size="small" allowClear={false} />
                      </Col>
                      <Col xs={12} sm={6} md={3}>
                        <Text type="secondary" style={{ fontSize: '0.8rem', display: 'block' }}>부서</Text>
                        {/* 💡 상수를 활용한 부서 자동 렌더링 */}
                        <Select value={filterDept} onChange={setFilterDept} style={{ width: '100%' }} size="small">
                          <Select.Option value="전체">전체</Select.Option>
                          {Object.keys(REGION_MAP).filter(d => d !== "미배정").map(d => <Select.Option key={d} value={d}>{d}</Select.Option>)}
                        </Select>
                      </Col>
                      <Col xs={12} sm={6} md={3}>
                        <Text type="secondary" style={{ fontSize: '0.8rem', display: 'block' }}>지역</Text>
                        <Input value={filterRegion === "전체" ? "" : filterRegion} onChange={e => setFilterRegion(e.target.value ? e.target.value : "전체")} placeholder="지역명" size="small" />
                      </Col>
                      <Col xs={12} sm={6} md={3}>
                        <Text type="secondary" style={{ fontSize: '0.8rem', display: 'block' }}>팀</Text>
                        <Input value={filterTeam === "전체" ? "" : filterTeam} onChange={e => setFilterTeam(e.target.value ? e.target.value : "전체")} placeholder="팀명" size="small" />
                      </Col>
                      <Col xs={12} sm={6} md={4}>
                        <Text type="secondary" style={{ fontSize: '0.8rem', display: 'block' }}>소속 24부서</Text>
                        <Input value={filter24Dept === "전체" ? "" : filter24Dept} onChange={e => setFilter24Dept(e.target.value ? e.target.value : "전체")} placeholder="24부서명" size="small" />
                      </Col>
                      <Col xs={12} sm={6} md={4}>
                        <Text type="secondary" style={{ fontSize: '0.8rem', display: 'block' }}>소속 센터</Text>
                        <Input value={filterCenter === "전체" ? "" : filterCenter} onChange={e => setFilterCenter(e.target.value ? e.target.value : "전체")} placeholder="센터명" size="small" />
                      </Col>
                    </Row>
                  </Card>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <Text>총 <Text strong style={{ color: MINT_COLOR }}>{filteredMembersData.length}</Text>명의 성도가 검색되었습니다.</Text>
                    <Text type="secondary" style={{ fontSize: '0.85rem' }}>💡 컬럼 제목(이름, 지역, 활동시간 등)을 클릭하면 정렬됩니다.</Text>
                  </div>

                  <Table columns={memberColumns} dataSource={filteredMembersData} rowKey="id" loading={loading} pagination={{ pageSize: 15, placement: ['bottomCenter'] }} scroll={{ x: 1000 }} size="middle" />
                </Card>
              )
            },
            {
              key: "3", label: <><SafetyCertificateOutlined /> 조직 및 사명 개편 (엑셀 일괄)</>, children: (
                <Card styles={{ body: { padding: '30px' } }} style={{ borderRadius: 12 }}>
                  <Title level={4}>엑셀 일괄 업로드 (최초 세팅 및 대규모 개편)</Title>
                  <Text type="secondary" style={{ display: 'block', marginBottom: 20 }}>조직이 대대적으로 개편되거나 최초 세팅을 진행할 때, 엑셀 양식을 업로드하여 한 번에 수천 명의 데이터를 업데이트합니다.</Text>
                  <Dragger accept=".xlsx, .xls" showUploadList={false} beforeUpload={handleExcelUpload} disabled={isUploading} style={{ padding: '40px 0', backgroundColor: '#fafafa', border: `2px dashed ${MINT_COLOR}` }}>
                    <p className="ant-upload-drag-icon"><UploadOutlined style={{ color: MINT_COLOR, fontSize: 40 }} /></p>
                    <p className="ant-upload-text" style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>클릭하거나 엑셀 파일을 여기로 드래그하세요</p>
                  </Dragger>
                  {isUploading && <div style={{ textAlign: 'center', marginTop: 20 }}><Spin tip="조직 데이터를 갱신 중입니다. 잠시만 기다려주세요..." /></div>}
                </Card>
              )
            }
          ]} />
        </div>
      </div>

      <Modal title={`사명 및 소속 정보 수정 - ${editingMember?.name}`} open={isRoleModalOpen} onCancel={() => setIsRoleModalOpen(false)} footer={null}>
        <Form form={roleForm} layout="vertical" onFinish={handleRoleSubmit} style={{ marginTop: 12 }}>
          <Row gutter={12}>
            {/* 💡 상수를 활용한 Select로 편의성 및 데이터 무결성 보장 */}
            <Col span={12}>
              <Form.Item name="dept_24" label="소속 24행정부서">
                <Select placeholder="선택 (없으면 빈칸)" allowClear showSearch>
                  {DEPARTMENT24_LIST.map(d => <Select.Option key={d} value={d}>{d}</Select.Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="center_church" label="소속 센터 (교역 전용)">
                <Select placeholder="선택 (없으면 빈칸)" allowClear showSearch>
                  {CENTER_LIST.map(c => <Select.Option key={c} value={c}>{c}</Select.Option>)}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="role_name" label="직책명 (빈칸 입력 시 사명 해제)" extra="예: 회장, 지역장, 구역장, 부장, 팀장 등">
            <Input placeholder="직책을 입력하세요" />
          </Form.Item>
          
          <Row gutter={12}>
            {/* 💡 관할 부서 역시 상수를 활용하여 Select 구성 */}
            <Col span={12}>
              <Form.Item name="target_dept" label="관할 부서">
                <Select placeholder="선택" allowClear>
                  {Object.keys(REGION_MAP).filter(d => d !== "미배정").map(dept => <Select.Option key={dept} value={dept}>{dept}</Select.Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}><Form.Item name="target_region" label="관할 지역"><Input placeholder="예: 장년 1지역" /></Form.Item></Col>
            <Col span={12}><Form.Item name="target_team" label="관할 팀"><Input placeholder="예: 1팀" /></Form.Item></Col>
            <Col span={12}><Form.Item name="target_sector" label="관할 구역"><Input placeholder="예: 1구역" /></Form.Item></Col>
          </Row>

          <Form.Item name="has_admin_access" valuePropName="checked" style={{ marginTop: 8 }}>
            <Checkbox><Text strong style={{ color: 'red' }}>관리자 대시보드 접속 권한 부여</Text></Checkbox>
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, marginTop: 20 }}>
            <Button type="primary" htmlType="submit" block size="large" style={{ borderRadius: 8 }}>저장하기</Button>
          </Form.Item>
        </Form>
      </Modal>

    </ConfigProvider>
  );
}