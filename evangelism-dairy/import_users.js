// import_users.js (로컬에서 1회성으로만 실행하는 스크립트)
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const csv = require('csv-parser');

// 🚨 주의: 이 작업은 최고 관리자 권한(service_role key)이 필요합니다. 
// Supabase 대시보드 API 설정에서 service_role 키를 복사해오세요. (절대 프론트엔드 코드에 넣지 마세요!)
const supabaseUrl = '본인의_SUPABASE_URL';
const supabaseServiceKey = '본인의_SERVICE_ROLE_KEY';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function processUsers() {
  const users = [];
  fs.createReadStream('users.csv') // 준비한 엑셀(csv) 파일
    .pipe(csv())
    .on('data', (row) => users.push(row))
    .on('end', async () => {
      console.log(`${users.length}명의 데이터를 처리합니다...`);
      
      for (const user of users) {
        const email = `${user.member_no}@ydp.com`;
        
        // 1. Auth 계정 생성 (비밀번호 000000 고정)
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email: email,
          password: '000000',
          email_confirm: true,
        });

        if (authError) {
          console.error(`Auth 에러 (${user.name}):`, authError.message);
          continue;
        }

        // 2. Members 테이블에 프로필 추가 (Auth의 UID 연동)
        const { error: dbError } = await supabase.from('members').insert([{
          id: authData.user.id, // 핵심! Auth UID 맵핑
          member_no: user.member_no,
          name: user.name,
          department: user.department,
          region: user.region,
        }]);

        if (dbError) {
          console.error(`DB 에러 (${user.name}):`, dbError.message);
        } else {
          console.log(`성공: ${user.name} 등록 완료`);
        }
      }
      console.log('🎉 모든 성도 데이터 업로드 완료!');
    });
}
processUsers();