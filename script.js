'use strict';
/* =========================================================
   COLD_BOOT — 게임 로직
   ---------------------------------------------------------
   1. 기본 설정과 도우미
   2. 이야기 데이터 (인물, 단서, 메신저, 메일, 로그, 파일, 사건표)
   3. 아이콘과 사진 (+ 3-1. 효과음)
   4. 상태와 저장
   5. 화면 크기 맞추기
   6. 창 관리
   7. 앱 화면 그리기
   8. 관찰 → 단서 기록
   9. 시간 흐름과 사건
   10. 원격 초기화, 회차 끝, 부팅
   11. 수사 노트와 보고서
   12. 엔딩
   13. 배경 (도시, 비)
   14. 입력 연결과 시작
   ========================================================= */


/* ---------------------------------------------------------
   1. 기본 설정과 도우미
   --------------------------------------------------------- */

const W = 1280;              // 게임 화면 너비
const H = 760;               // 게임 화면 높이
const TASKBAR = 48;          // 작업 표시줄 높이
const SEC_PER_MIN = 3;       // 1배속에서 게임 1분 = 실제 3초 → 한 회차 약 6분
const LOOP_LEN = 120;        // 22:00 ~ 24:00
const WIPE_AT = 118;         // 23:58 원격 초기화 시작
const SAVE_KEY = 'coldboot_save_v3';
const TODAY = '11월 20일 금요일';
const COARSE = matchMedia('(pointer: coarse)').matches;
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pad2 = n => String(n).padStart(2, '0');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// '23:41' → 22:00부터 지난 분 (101)
function tm(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return (h < 12 ? h + 24 : h) * 60 + m - 22 * 60;
}

// 101 → '23:41'
function clockText(t) {
  const total = 22 * 60 + Math.floor(t);
  return pad2(Math.floor(total / 60) % 24) + ':' + pad2(total % 60);
}


/* ---------------------------------------------------------
   2. 이야기 데이터
   --------------------------------------------------------- */

const PEOPLE = {
  seojin: { name: '한서진', ch: '서', color: '#7aa2ff' },
  harin:  { name: '오하린', ch: '하', color: '#ff9cbc' },
  mom:    { name: '엄마',   ch: '엄', color: '#f2c46a' },
  doyun:  { name: '한도윤', ch: '도', color: '#5fd6ac' },
  kang:   { name: '강준혁', ch: '강', color: '#a9b6d6' },
  moon:   { name: '문태경', ch: '문', color: '#c6a4ff' },
};

// 단서: t가 있으면 타임라인에 올라감, w는 이 단서를 보면 모이는 단어 (보고서 빈칸용)
const CLUES = {
  memo:      { title: 'COLD_BOOT의 정체', src: '바탕화면 메모', w: [],
               body: '서진의 PC는 매일 22:00에 스냅샷을 뜨고 그 뒤의 통신과 파일 변경을 기록한다. 지금 보는 건 11월 20일 밤의 재생이다.' },
  diary:     { title: '비어 있는 4억 2천만 원', src: '문서 › 업무일지', w: ['에버그린 홀딩스', '윤서영'],
               body: '예치금이 4억 2천만 원 모자란다. 출금처는 "에버그린 홀딩스". 서진이 떼 본 등기에 적힌 대표 이름은 윤서영. "어디서 들어본 이름인데."' },
  assets:    { title: '업무용 PC 자산 목록', src: '메일 · 총무팀', w: ['QA-HARIN-01', 'DEV-KANG-02', 'CEO-MOON-MBP', 'DEV-HANSJ-03', '오하린', '강준혁', '문태경', '박민정'],
               body: 'CEO-MOON-MBP = 문태경 · DEV-KANG-02 = 강준혁 · DEV-HANSJ-03 = 한서진 · QA-HARIN-01 = 오하린 (10.0.4.17)' },
  admin:     { title: '빌려준 관리자 계정', src: '메일 · 강준혁 · 11/20 09:12', w: ['kang.jh', '09:12', '오하린', '강준혁'],
               body: '사건 당일 아침 09:12, 강준혁은 자기 관리자 계정(kang.jh)을 QA팀 오하린에게 "임시로" 공유했다. MDM 콘솔 권한 포함.' },
  wedding:   { title: '오래된 청첩장', src: '메일 · 2025년 10월', w: ['윤서영', '강준혁', '부산'],
               body: '"준혁 ♥ 서영, 결혼합니다." 신부 윤서영, 2025년 11월 8일 부산 해운대에서 결혼.' },
  usb:       { t: '22:25', title: 'USB 연결', src: '이벤트 뷰어', w: [],
               body: '22:25, 서진이 SanDisk 32GB USB(E:)를 꽂았다.' },
  ask:       { t: '22:18', title: '서진이 하린에게 꺼낸 말', src: '링크톡 · 오하린', w: ['22:18'],
               body: '22:18, 서진이 하린에게 처음으로 예치금 테이블 이야기를 꺼냈다. "숫자가 좀 이상해서."' },
  zip:       { t: '22:31', title: '암호 걸린 백업', src: '다운로드 폴더', w: [],
               body: '22:31, ledger_backup.zip이 생겼다. 암호 힌트: "제천 할머니 집 와이파이".' },
  pwhint:    { t: '22:44', title: '누나가 남긴 힌트', src: '링크톡 · 우리 가족', w: [],
               body: '서진: "도윤아 혹시 나중에 내가 뭐 보내면, 비번은 제천 할머니 집 와이파이야."' },
  alibi:     { t: '22:50', title: '강준혁의 알리바이', src: '링크톡 · 개발팀', w: ['부산', '강준혁'],
               body: '22:50, 강준혁은 부산 처가로 내려가는 KTX 안이며 노트북을 회사에 두고 왔다고 했다.' },
  perm:      { t: '23:00', title: '회수된 권한', src: '메일 · 이벤트 뷰어', w: ['moon.tk', '23:00', 'han.seojin'],
               body: '23:00, 서진의 예치금DB 읽기 권한이 제거됐다. 변경한 사람: moon.tk (문태경).' },
  unrevoked: { t: '23:12', title: '아직 회수되지 않은 계정', src: '링크톡 · 개발팀', w: ['문태경'],
               body: '23:10, 문태경이 "QA팀에 공유한 관리자 계정 회수했냐"고 묻는다. 강준혁: "아직이요."' },
  pw:        { t: '23:15', title: '비밀번호: jecheon0807', src: '링크톡 · 우리 가족', w: [],
               body: '23:15, 엄마가 알려준 제천 집 와이파이. 할아버지 생신(8월 7일)으로 만든 비밀번호.' },
  deleted:   { t: '23:41', title: '2분 만에 지워진 메시지', src: '링크톡 · 오하린', w: ['23:41', '오하린', '문태경', '강준혁'],
               body: '하린 → (대표님에게 보내려던 것) "서진이 눈치챘어요. USB에 백업까지 떠놨어요. 자정 전에 제가 준혁 팀장님 계정으로 원격 초기화 걸게요."' },
  decoy:     { t: '23:46', title: '강릉으로 간다는 말', src: '링크톡 · 오하린', w: ['강릉역'],
               body: '23:46, 서진이 하린에게 "오늘 밤 강릉 내려간다"고 말했다. 하린의 메시지를 본 직후다.' },
  taxi:      { t: '23:47', title: '강릉역 택시 예약', src: '메일 · 바로콜', w: ['강릉역', '판교 자택', '바로콜'],
               body: '23:47, 판교 → 강릉역 택시 예약 확정 (00:10 픽업).' },
  secret:    { t: '23:50', title: '"비밀기지 기억하지?"', src: '링크톡 · 우리 가족', w: [],
               body: '23:50, 서진이 가족방에: "도윤아 비밀기지 기억하지? 미안해. 엄마한테는 아직 말하지 마." 읽지 않음 1.' },
  mdmmail:   { t: '23:55', title: '원격 초기화 승인', src: '메일 · MDM', w: ['kang.jh', '23:55'],
               body: '23:55, MDM 알림: 이 PC의 원격 초기화를 승인한 계정은 kang.jh (강준혁).' },
  mdmlog:    { t: '23:55', title: '명령을 보낸 기기', src: '이벤트 뷰어', w: ['QA-HARIN-01', 'kang.jh', '23:55'],
               body: '23:55, WIPE 명령의 발신 기기는 QA-HARIN-01 (10.0.4.17).' },
  ledger:    { title: '송금 내역', src: 'ledger_backup.zip', w: ['에버그린 홀딩스', 'moon.tk', '윤서영'],
               body: '고객 예치금 4억 2천만 원이 일곱 번에 걸쳐 에버그린 홀딩스로 나갔다. 승인자는 모두 moon.tk. 에버그린의 법인 대표는 윤서영.' },
  letter:    { title: '도윤에게', src: 'ledger_backup.zip', w: [],
               body: '"사람들이 날 찾는 곳엔 없을 거야. 어디로 간다고 말하든 믿지 마. 사다리 치우면 아무도 못 올라오는 데, 거기 있을게."' },
  photo:     { title: '우리 비밀기지', src: '사진 폴더', w: ['제천 할머니 집 다락'],
               body: '2009년 여름. 제천 할머니 집 창고 위 다락. 사다리를 치우면 아무도 못 올라오는 곳.' },
};

// 보고서 빈칸에 넣을 수 있는 단어와 종류
const WORDS = {
  '오하린': 'person', '강준혁': 'person', '문태경': 'person', '한서진': 'person', '박민정': 'person', '윤서영': 'person',
  'kang.jh': 'account', 'moon.tk': 'account', 'han.seojin': 'account',
  'QA-HARIN-01': 'device', 'DEV-KANG-02': 'device', 'CEO-MOON-MBP': 'device', 'DEV-HANSJ-03': 'device',
  '에버그린 홀딩스': 'company', '바로콜': 'company', '페이로드': 'company',
  '부산': 'place', '강릉역': 'place', '판교 자택': 'place', '제천 할머니 집 다락': 'place', '강남역': 'place',
  '09:12': 'time', '22:18': 'time', '23:00': 'time', '23:41': 'time', '23:55': 'time',
  '강준혁의 아내': 'relation', '외부 거래처': 'relation', '재무팀 직원': 'relation', '문태경의 동생': 'relation',
};
const STARTER_WORDS = ['한서진', '페이로드', '강남역', '외부 거래처', '재무팀 직원', '문태경의 동생'];
const TYPE_LABEL = { person: '인물', account: '계정', device: '기기', company: '회사', place: '장소', time: '시각', relation: '관계' };

// 연결 보드: 두 카드를 고르고 연결고리 단어(key 중 하나)를 고르면 생기는 추론 (추론 카드끼리도 이을 수 있음)
const DEDUCTIONS = [
  { id: 'd_device', key: ['QA-HARIN-01'], pairs: [['mdmlog', 'assets']], w: [],
    title: '명령은 하린의 PC에서', body: '초기화 명령을 보낸 QA-HARIN-01은 오하린의 업무용 PC다.' },
  { id: 'd_alibi', key: ['kang.jh', '강준혁'], pairs: [['admin', 'alibi'], ['mdmmail', 'alibi'], ['mdmlog', 'alibi']], w: [],
    title: '계정 주인은 자리에 없었다', body: 'kang.jh의 주인 강준혁은 그 시각 부산행 KTX 안. 버튼을 누른 건 계정을 빌린 사람이다.' },
  { id: 'd_leak', key: ['오하린', '22:18'], pairs: [['ask', 'perm']], w: [],
    title: '누가 대표에게 알렸나', body: '22:18, 서진이 하린에게만 예치금 이야기를 꺼냈다. 42분 뒤 대표가 서진의 권한을 회수했다. 그 사이에 말을 옮긴 사람이 있다.' },
  { id: 'd_wife', key: ['윤서영'], pairs: [['wedding', 'ledger'], ['wedding', 'diary']], w: ['강준혁의 아내'],
    title: '에버그린의 대표', body: '송금을 받은 에버그린 홀딩스의 대표 윤서영은 강준혁의 아내다.' },
  { id: 'd_plan', key: ['강준혁', '09:12', '부산'], pairs: [['d_wife', 'd_alibi'], ['d_wife', 'admin']], w: [],
    title: '준비된 알리바이', body: '강준혁은 사건 당일 아침 계정을 하린에게 넘기고 처가가 있는 부산으로 떠났다. 돈은 아내의 회사로 갔다. 그는 피해자가 아니다.' },
  { id: 'd_decoy', key: ['강릉역'], pairs: [['taxi', 'letter'], ['decoy', 'letter'], ['taxi', 'secret'], ['decoy', 'secret']], w: [],
    title: '강릉은 미끼', body: '"어디로 간다고 말하든 믿지 마." 강릉행 택시는 남들 보라고 잡은 것이다.' },
  { id: 'd_base', key: ['제천 할머니 집 다락'], pairs: [['letter', 'photo'], ['secret', 'photo']], w: [],
    title: '사다리 치우면 못 올라오는 곳', body: '편지 속 "어릴 때 숨던 데"는 제천 할머니 집 창고 위 다락, 우리 비밀기지다.' },
];

// 3단계 보고서: 문장 안의 빈칸을 모은 단어로 채움. need는 연결 보드에서 증명해야 하는 추론
const B = (b, type, a) => ({ b, type, a });
const STAGES = [
  {
    title: '그날 밤 무슨 일이 있었나',
    need: ['d_device', 'd_alibi'],
    lines: [
      ['23시 55분, 초기화 명령은 ', B('s1_dev', 'device', 'QA-HARIN-01'), '에서 ', B('s1_acc', 'account', 'kang.jh'), ' 계정으로 보내졌다.'],
      ['그 기기의 주인은 ', B('s1_who', 'person', '오하린'), '(이)다.'],
      ['계정 주인 ', B('s1_owner', 'person', '강준혁'), '은(는) 그 시각 ', B('s1_place', 'place', '부산'), '행 KTX 안에 있었다.'],
    ],
    reveal: '버튼을 누른 건 서진의 가장 친한 친구였다. 그리고 계정 주인 강준혁은 그 시각 서울에 없었다. 여기까지는 누구라도 그렇게 생각할 것이다.',
  },
  {
    title: '4억 2천만 원은 누구에게 갔나',
    need: ['d_wife', 'd_plan'],
    lines: [
      ['고객 예치금은 ', B('s2_co', 'company', '에버그린 홀딩스'), '(으)로 빠져나갔고, 승인 계정은 ', B('s2_acc', 'account', 'moon.tk'), '(이)었다.'],
      ['에버그린 홀딩스의 대표 ', B('s2_ceo', 'person', '윤서영'), '은(는) ', B('s2_rel', 'relation', '강준혁의 아내'), '(이)다.'],
      ['관리자 계정은 사건 당일 ', B('s2_time', 'time', '09:12'), '에 하린에게 넘어갔다.'],
    ],
    reveal: '강준혁은 피해자가 아니었다.',
  },
  {
    title: '서진은 어디에 있나',
    need: ['d_decoy', 'd_base'],
    lines: [
      ['서진이 하린에게 말하고 택시까지 예약한 ', B('s3_fake', 'place', '강릉역'), '은(는) 미끼다.'],
      ['서진은 ', B('s3_real', 'place', '제천 할머니 집 다락'), '에 있다.'],
    ],
    reveal: '',
  },
];

// 막혔을 때 힌트 (c: 단서, d: 추론, 아직 없는 것부터 순서대로)
function nextHint() {
  if (Object.keys(save.clues).length < 2) return '메시지에 마우스를 올리면 오른쪽에 📌 핀이 보입니다. 메일·로그·문서 창에도 핀 단추가 있습니다. 직접 꽂아야 노트에 남습니다.';
  if (Object.keys(save.words || {}).length < 3) return '글 속 이름, 계정, 기기, 장소, 시각에 마우스를 올리면 밑줄이 생깁니다. 누르면 보고서와 연결 보드에 쓸 단어로 모입니다.';
  const h = HINTS.find(([k, id]) => (k === 'c' ? !save.clues[id] : !save.deds[id]));
  return h ? h[2] : '';
}

const HINTS = [
  ['c', 'memo', '바탕화면의 COLD_BOOT_메모.txt부터 열어 보세요. 이 PC가 무엇인지 알 수 있습니다.'],
  ['c', 'assets', '받은편지함의 지난 공지도 읽어 보세요. 기기 이름마다 주인이 적혀 있습니다.'],
  ['c', 'mdmlog', '23:55에 이벤트 뷰어가 열려 있어야 볼 수 있는 기록이 있습니다. 23:58이 지나면 손쓸 수 없습니다.'],
  ['d', 'd_device', '"초기화 명령을 보낸 기기"와 "기기 이름의 주인이 적힌 자료"를 이어 보세요. 연결고리는 두 카드에 모두 나오는 기기 이름입니다.'],
  ['c', 'alibi', '개발팀 단톡방은 22시 50분쯤 한 번 더 울립니다.'],
  ['d', 'd_alibi', '관리자 계정의 주인은 그 시각 어디에 있었나요? 계정에 관한 단서와 그의 행방을 이어 보세요.'],
  ['c', 'zip', '22:31쯤 다운로드 폴더에 새 파일이 생깁니다.'],
  ['c', 'pw', '가족 단톡방은 23시가 넘어서도 대화가 이어집니다.'],
  ['c', 'ledger', '비밀번호를 알았다면, 다음 회차에서는 22:31 직후 바로 압축을 풀 수 있습니다.'],
  ['c', 'wedding', '받은편지함 맨 아래, 오래된 메일 중에 이름 두 개가 나란히 적힌 것이 있습니다.'],
  ['d', 'd_wife', '송금을 받은 회사의 대표 이름, 어디선가 본 적 있지 않나요?'],
  ['d', 'd_plan', '추론 카드끼리도 이을 수 있습니다. 강준혁에 관한 두 추론을 이어 보세요.'],
  ['c', 'letter', '압축 파일 안에는 송금 내역 말고 편지도 있습니다.'],
  ['c', 'photo', '사진 폴더에 서진과 도윤의 어린 시절이 있습니다.'],
  ['d', 'd_base', '편지 속 "어릴 때 숨던 데"를 보여 주는 단서가 있습니다.'],
  ['d', 'd_decoy', '"어디로 간다고 말하든 믿지 마." 이 말과 어울리는 행동을 찾아 이어 보세요.'],
  ['d', 'd_leak', '(보너스) 서진은 22:18에 누구에게 처음 말했나요? 그리고 23:00에 무슨 일이 있었나요?'],
];

// 메신저 대화방과 22:00 이전 기록
const CHATS = [
  {
    id: 'harin', title: '오하린', who: 'harin',
    history: [
      { day: '11월 19일 목요일', time: '19:02', who: 'harin', text: '내일 회식 올 거지? 대표님이 쏘신대 🍖' },
      { day: '11월 19일 목요일', time: '19:10', who: 'seojin', text: '봐서~ 요즘 정산 때문에 정신없어' },
      { day: TODAY, time: '18:40', who: 'harin', text: '서진아 진짜 안 와? 니 자리 맡아놨는데' },
      { day: TODAY, time: '18:52', who: 'seojin', text: '미안 ㅠ 오늘은 패스. 확인할 게 있어' },
      { day: TODAY, time: '18:53', who: 'harin', text: '또 일이야? 몸 좀 챙겨라 진짜' },
    ],
  },
  {
    id: 'family', title: '우리 가족', count: 3, group: ['mom', 'doyun'],
    history: [
      { day: '11월 18일 수요일', time: '08:12', who: 'mom', text: '얘들아 29일 할아버지 제사다. 시간 비워놔라' },
      { day: '11월 18일 수요일', time: '08:30', who: 'doyun', text: '넵' },
      { day: '11월 18일 수요일', time: '09:02', who: 'seojin', text: '응 엄마' },
      { day: '11월 18일 수요일', time: '09:05', who: 'mom', text: '서진이 밥은 먹고 다니냐' },
    ],
  },
  {
    id: 'team', title: '페이로드 개발팀', count: 6, group: ['kang', 'moon'],
    history: [
      { day: TODAY, time: '17:55', who: 'kang', text: '이번 주 금요일 배포 없습니다. 다들 주말 잘 보내세요' },
      { day: TODAY, time: '18:02', who: 'moon', text: '다들 한 주 고생 많았어요. 회식 7시 강남역 3번 출구' },
      { day: TODAY, time: '18:03', who: 'harin', text: '넵 대표님!' },
    ],
  },
];

// 22:00 스냅샷에 있던 메일 (최신순)
const MAILS0 = [
  {
    id: 'ceo', from: '문태경', addr: 'tk.moon@payroad.kr', to: '페이로드 전체', date: '17:40', full: '2026-11-20 (금) 17:40',
    subject: '[공지] 11월 정산 마감 및 예치금 계정 운영 안내',
    body: `<p>11월 정산 마감 주간입니다.</p>
      <p>예치금 계정(<code>ledger_prod</code>)은 재무팀과 대표 승인 하에서만 운영됩니다. 개인적으로 조회하거나 추출하는 일이 없도록 해 주세요. 보안 감사 대상입니다.</p>
      <p class="sig">문태경 · 대표이사</p>`,
  },
  {
    id: 'admin', from: '강준혁', addr: 'jh.kang@payroad.kr', to: '개발팀, QA팀', date: '09:12', full: '2026-11-20 (금) 09:12', clue: 'admin', read: true,
    subject: '[공지] 배포 테스트용 관리자 계정 임시 공유',
    body: `<p>QA팀 오하린 님께 배포 테스트용으로 제 관리자 계정(<code>kang.jh</code>)을 임시 공유했습니다.</p>
      <p>MDM 콘솔 접근 권한이 포함되어 있으니 테스트 외 용도로는 쓰지 말아 주세요. 테스트가 끝나는 대로 비밀번호를 바꾸겠습니다.</p>
      <p class="sig">강준혁 · 개발팀장</p>`,
  },
  {
    id: 'assets', from: '총무팀', addr: 'admin@payroad.kr', to: '페이로드 전체', date: '11.19', full: '2026-11-19 (목) 14:30', clue: 'assets', read: true,
    subject: '[자산] 업무용 PC 자산 목록 갱신 안내',
    body: `<p>안녕하세요, 총무팀입니다.<br>11월 기준 업무용 PC 자산 목록을 갱신했습니다. 기기 이름은 MDM 콘솔과 보안 로그에 그대로 표시됩니다.</p>
      <table class="mtable"><thead><tr><th>기기 이름</th><th>사용자</th><th>부서</th><th>IP</th></tr></thead><tbody>
      <tr><td>CEO-MOON-MBP</td><td>문태경</td><td>대표</td><td>10.0.1.2</td></tr>
      <tr><td>DEV-KANG-02</td><td>강준혁</td><td>개발</td><td>10.0.2.11</td></tr>
      <tr><td>DEV-HANSJ-03</td><td>한서진</td><td>개발</td><td>10.0.2.14</td></tr>
      <tr><td>QA-HARIN-01</td><td>오하린</td><td>QA</td><td>10.0.4.17</td></tr>
      <tr><td>FIN-PARK-01</td><td>박민정</td><td>재무</td><td>10.0.3.5</td></tr>
      </tbody></table>
      <p class="sig">페이로드 총무팀 · 내선 1004</p>`,
  },
  {
    id: 'coupon', from: '바로콜', addr: 'noreply@barocall.kr', to: '한서진', date: '11.17', full: '2026-11-17 (월) 10:00', read: true,
    subject: '[바로콜] 11월 심야 할증 할인 쿠폰이 도착했어요',
    body: `<p>서진 님, 늦은 귀가길도 바로콜과 함께하세요.</p><p><span class="tag">심야 20% 할인</span> 11월 30일까지 사용 가능</p>`,
  },
  {
    id: 'wedding', from: '강준혁', addr: 'jh.kang@payroad.kr', to: '페이로드 전체', date: '25.10.02', full: '2025-10-02 (목) 18:20', clue: 'wedding', read: true,
    subject: '[청첩장] 준혁 ♥ 서영, 결혼합니다',
    body: `<div class="invite"><small>WEDDING INVITATION</small><b>강준혁 <i>♥</i> 윤서영</b><p>2025년 11월 8일 토요일 낮 12시<br>부산 해운대 라온웨딩홀 3층</p></div>
      <p>바쁘신 와중에 꼭 와 달라는 말씀은 못 드리지만, 마음으로 축하해 주시면 감사하겠습니다. 신부 쪽이 부산이라 멀리서 예식을 올리게 됐습니다.</p>
      <p class="sig">강준혁 드림</p>`,
  },
];

const LOGS0 = [
  { time: '21:12:03', lv: 'info', src: 'Kernel-Power', text: '시스템이 절전 모드에서 다시 시작되었습니다.' },
  { time: '21:12:09', lv: 'info', src: 'Netlogon', text: 'payroad.kr 도메인에 연결되었습니다 (VPN).' },
  { time: '21:47:55', lv: 'warn', src: 'Defender', text: '정의 업데이트를 건너뛰었습니다 — 회사 정책.' },
  { time: '21:59:58', lv: 'info', src: 'COLD_BOOT', text: '스냅샷 생성을 시작합니다.' },
  { time: '22:00:00', lv: 'info', src: 'COLD_BOOT', text: '스냅샷 생성 완료 · 통신 및 파일 변경 기록을 시작합니다.' },
];

const FILES0 = {
  desktop: [
    { name: 'COLD_BOOT_메모.txt', icon: 'txt', kind: 'doc', ref: 'memo', size: '1 KB', mod: '2026-11-02 01:14' },
  ],
  docs: [
    { name: '업무일지_11월.txt', icon: 'txt', kind: 'doc', ref: 'diary', size: '2 KB', mod: '2026-11-20 21:40' },
    { name: '이력서_한서진_2024.pdf', icon: 'pdf', kind: 'pdf', size: '412 KB', mod: '2024-03-11 23:02' },
  ],
  downloads: [
    { name: '바로콜_영수증_1103.pdf', icon: 'pdf', kind: 'pdf', size: '88 KB', mod: '2026-11-03 23:51' },
  ],
  photos: [
    { name: '2009_제천_할머니집.jpg', icon: 'img', kind: 'photo', ref: 'house', size: '1.2 MB', mod: '2009-07-26 15:22' },
    { name: '2009_비밀기지.jpg', icon: 'img', kind: 'photo', ref: 'attic', size: '0.9 MB', mod: '2009-07-26 16:05' },
    { name: '2021_강릉_워크숍.jpg', icon: 'img', kind: 'photo', ref: 'sea', size: '3.8 MB', mod: '2021-06-19 19:48' },
  ],
  trash: [
    { name: '하린_생일선물.txt', icon: 'txt', kind: 'doc', ref: 'gift', size: '1 KB', mod: '2026-11-12 00:31' },
  ],
};

const FOLDERS = [
  ['desktop', '바탕화면', 'folder'],
  ['docs', '문서', 'folder'],
  ['downloads', '다운로드', 'folder'],
  ['photos', '사진', 'folder'],
  ['trash', '휴지통', 'trash'],
];

const DOCS = {
  memo: { clue: 'memo', text:
`COLD_BOOT v0.3 — 개인용 메모

- 매일 22:00, 이 PC의 스냅샷을 뜬다.
- 22:00 이후의 통신(메신저, 메일)과 파일 변경, 시스템 로그를 전부 기록한다.
- 3일 동안 내가 로그인하지 않으면 이미지가 도윤이에게 자동으로 간다.
- 이미지를 켜면 그날 밤이 그대로 다시 재생된다.
  기록이 끝나는 지점에서 스냅샷으로 돌아간다. 몇 번이든.

도윤아, 이걸 보고 있다면 미안. 그리고 고마워.

재생은 바꿀 수 없어.
하지만 보는 건 몇 번이고 할 수 있어.
한 번에 다 보려고 하지 마.` },

  diary: { clue: 'diary', text:
`11/03  정산 배치 리팩터링 시작.
11/07  준혁 팀장님 휴가. 코드 리뷰 밀림.
11/14  예치금 테이블 합계가 고객 잔액 합계랑 안 맞는다.
       차이 420,000,000원. 반올림 문제 아님.
11/16  출금 로그에 "에버그린 홀딩스"라는 거래처.
       계약서도, 세금계산서도 없음. 승인자 확인 필요.
11/18  하린이한테 말할까 하다가 말았다.
       아직 확실하지 않으니까.
11/19  에버그린 등기부 떼 봄. 대표 윤서영.
       어디서 들어본 이름인데.
11/20  오늘 밤 원본 뽑아서 백업한다.
       비번은 도윤이만 알 수 있게.
       COLD_BOOT 켜 둠.` },

  gift: { text:
`하린 생일 12/3

- 향수 (뭐 좋아하는지 물어보기)
- 목도리
- 강릉 그 카페 원두   ← 이거다
  (워크숍 때 둘이 빠져나가서 갔던 데)` },

  letter: { clue: 'letter', text:
`도윤아.

이걸 열었다면 제천 집 와이파이를 기억해냈거나,
엄마한테 물어봤겠지.

같이 들어 있는 송금내역은 우리 회사 고객 돈이
어디로 갔는지 보여 줘. 원본은 USB에 있어.

혹시 내가 연락이 안 되면,
사람들이 날 찾는 곳엔 없을 거야.
어디로 간다고 말하든 믿지 마.
그건 남들 들으라고 하는 말이야.

우리 어릴 때 숨던 데 기억나?
사다리 치우면 아무도 못 올라오는 데.
거기 있을게.

- 누나가` },
};

const LEDGER = [
  ['2026-09-03', 48000000, '서버 유지보수'],
  ['2026-09-24', 72000000, '외주 개발비'],
  ['2026-10-08', 55000000, '보안 컨설팅'],
  ['2026-10-22', 60000000, '서버 유지보수'],
  ['2026-11-04', 65000000, '라이선스 갱신'],
  ['2026-11-12', 70000000, '외주 개발비'],
  ['2026-11-18', 50000000, '보안 컨설팅'],
];

// 22:00 이후 일어나는 일 (재생 기록)
const EVENTS = [
  // 링크톡 — 오하린
  { t: '22:06', type: 'msg', chat: 'harin', who: 'harin', text: '아직 일해? 다들 너 어디 갔냐고 물어보더라 ㅋㅋ' },
  { t: '22:08', type: 'msg', chat: 'harin', who: 'seojin', text: '응 확인할 게 좀 있어서' },
  { t: '22:18', type: 'msg', chat: 'harin', who: 'seojin', clue: 'ask', text: '하린아 너 QA 서버에서 예치금 테이블 본 적 있어?' },
  { t: '22:19', type: 'msg', chat: 'harin', who: 'harin', text: '아니? 그건 대표님이랑 재무팀만 볼 수 있잖아' },
  { t: '22:19', type: 'msg', chat: 'harin', who: 'harin', text: '왜??' },
  { t: '22:21', type: 'msg', chat: 'harin', who: 'seojin', text: '아냐 그냥. 숫자가 좀 이상해서' },
  { t: '22:22', type: 'msg', chat: 'harin', who: 'harin', text: '뭐가? 말해봐' },
  { t: '23:02', type: 'msg', chat: 'harin', who: 'harin', text: '서진아 답장 왜 안 해 ㅠ' },
  { t: '23:20', type: 'msg', chat: 'harin', who: 'harin', text: '너 오늘 진짜 이상해. 내가 너네 집 갈까?' },
  { t: '23:22', type: 'msg', chat: 'harin', who: 'seojin', text: '아니 괜찮아. 혹시 나한테 무슨 일 생기면 도윤이한테 연락 좀 해줘' },
  { t: '23:23', type: 'msg', chat: 'harin', who: 'harin', text: '무슨 소리야 무섭게 ㅠㅠ' },
  { t: '23:39', type: 'typing', chat: 'harin', who: 'harin', until: '23:41' },
  { t: '23:41', type: 'msg', chat: 'harin', who: 'harin', key: 'slip', clue: 'deleted', text: '대표님, 서진이 눈치챘어요. USB에 백업까지 떠놨어요. 자정 전에 제가 준혁 팀장님 계정으로 원격 초기화 걸게요.' },
  { t: '23:43', type: 'delete', chat: 'harin', key: 'slip' },
  { t: '23:44', type: 'msg', chat: 'harin', who: 'seojin', text: '하린아?' },
  { t: '23:44', type: 'msg', chat: 'harin', who: 'seojin', text: '방금 그거 뭐야' },
  { t: '23:45', type: 'msg', chat: 'harin', who: 'harin', text: '아 잘못 보냈어 ㅋㅋ 업무 얘기야 신경 쓰지 마' },
  { t: '23:46', type: 'msg', chat: 'harin', who: 'seojin', clue: 'decoy', text: '응 ㅎㅎ 나 오늘 밤에 강릉 내려가려고. 바다 보고 싶어서' },
  { t: '23:47', type: 'msg', chat: 'harin', who: 'harin', text: '갑자기? 조심히 가 ㅠ 도착하면 꼭 연락해' },

  // 링크톡 — 우리 가족
  { t: '22:40', type: 'msg', chat: 'family', who: 'mom', text: '서진아 29일 제사 오지? 할머니가 너 보고 싶어 하신다' },
  { t: '22:42', type: 'msg', chat: 'family', who: 'seojin', text: '응 엄마 갈게' },
  { t: '22:44', type: 'msg', chat: 'family', who: 'seojin', clue: 'pwhint', text: '도윤아 혹시 나중에 내가 뭐 보내면, 비번은 제천 할머니 집 와이파이야' },
  { t: '22:47', type: 'msg', chat: 'family', who: 'doyun', text: '갑자기? ㅋㅋ 그걸 어떻게 기억해' },
  { t: '22:48', type: 'msg', chat: 'family', who: 'seojin', text: '기억 안 나면 엄마한테 물어봐' },
  { t: '23:14', type: 'typing', chat: 'family', who: 'mom', until: '23:15' },
  { t: '23:15', type: 'msg', chat: 'family', who: 'mom', clue: 'pw', text: 'jecheon0807 이거 아니니? 할아버지 생신으로 했잖아' },
  { t: '23:15', type: 'msg', chat: 'family', who: 'mom', text: '근데 그건 왜?' },
  { t: '23:16', type: 'msg', chat: 'family', who: 'seojin', text: '그냥 ㅎㅎ 고마워 엄마. 잘 자' },
  { t: '23:50', type: 'msg', chat: 'family', who: 'seojin', clue: 'secret', unread: true, text: '도윤아 비밀기지 기억하지?' },
  { t: '23:50', type: 'msg', chat: 'family', who: 'seojin', unread: true, text: '미안해. 엄마한테는 아직 말하지 마' },

  // 링크톡 — 개발팀
  { t: '22:50', type: 'msg', chat: 'team', who: 'kang', clue: 'alibi', text: '저 지금 부산 처가 내려가는 KTX인데 노트북을 회사에 두고 왔네요 ㅠ 월요일까지 급한 건 전화 주세요' },
  { t: '23:10', type: 'msg', chat: 'team', who: 'moon', text: '준혁 팀장, QA팀에 공유한 관리자 계정 회수했어요?' },
  { t: '23:12', type: 'msg', chat: 'team', who: 'kang', clue: 'unrevoked', text: '아 아직이요;; 월요일 출근하자마자 바꾸겠습니다' },
  { t: '23:13', type: 'msg', chat: 'team', who: 'moon', text: '알겠어요' },

  // 메일
  { t: '23:00', type: 'mail', mail: {
    id: 'perm', from: '페이로드 보안', addr: 'security@payroad.kr', to: '한서진', date: '23:00', full: '2026-11-20 (금) 23:00', clue: 'perm',
    subject: '[보안] 계정 권한이 변경되었습니다',
    body: `<p>회원님 계정의 권한이 관리자에 의해 변경되었습니다.</p>
      <dl class="kv"><dt>계정</dt><dd>han.seojin</dd><dt>변경 내용</dt><dd>예치금DB(<code>ledger_prod</code>) 읽기 권한 제거</dd><dt>변경자</dt><dd><b>moon.tk</b></dd><dt>시각</dt><dd>2026-11-20 23:00:04</dd></dl>
      <p class="sig">본인이 요청하지 않았다면 보안 담당자에게 문의하세요.</p>` } },
  { t: '23:47', type: 'mail', mail: {
    id: 'taxi', from: '바로콜', addr: 'noreply@barocall.kr', to: '한서진', date: '23:47', full: '2026-11-20 (금) 23:47', clue: 'taxi',
    subject: '[바로콜] 예약이 확정되었습니다',
    body: `<div class="receipt"><b>예약 확정</b><dl class="kv"><dt>픽업</dt><dd>11월 21일 00:10</dd><dt>출발</dt><dd>성남시 분당구 판교 (자택)</dd><dt>도착</dt><dd><b>강릉역</b></dd><dt>예상 요금</dt><dd>182,400원 (심야 할증)</dd></dl></div>
      <p class="sig">기사님이 배정되면 다시 알려 드릴게요.</p>` } },
  { t: '23:55', type: 'mail', mail: {
    id: 'mdm', from: '페이로드 MDM', addr: 'mdm@payroad.kr', to: '한서진', date: '23:55', full: '2026-11-20 (금) 23:55', clue: 'mdmmail',
    subject: '[MDM] 이 기기에 원격 초기화가 예약되었습니다',
    body: `<p><span class="tag red">되돌릴 수 없음</span></p>
      <dl class="kv"><dt>대상 기기</dt><dd>DEV-HANSJ-03 (한서진)</dd><dt>명령</dt><dd>WIPE — 전체 초기화</dd><dt>승인 계정</dt><dd><b>kang.jh</b></dd><dt>실행 예정</dt><dd>23:58</dd></dl>
      <p class="sig">이 메일은 발신 전용입니다.</p>` } },

  // 시스템 로그
  { t: '22:25', type: 'log', log: { time: '22:25:41', lv: 'warn', src: 'USB', clue: 'usb', text: '이동식 저장 장치 연결됨 — SanDisk Ultra 32GB (E:)' } },
  { t: '22:25', type: 'usb', on: true },
  { t: '22:29', type: 'log', log: { time: '22:29:12', lv: 'info', src: 'SQL Client', text: 'ledger_prod 조회 · withdrawals 테이블 412행 추출 (han.seojin)' } },
  { t: '22:31', type: 'log', log: { time: '22:31:07', lv: 'info', src: '파일 시스템', text: '새 파일: C:\\Users\\seojin\\Downloads\\ledger_backup.zip (AES-256)' } },
  { t: '22:31', type: 'file', dir: 'downloads', file: { name: 'ledger_backup.zip', icon: 'zip', kind: 'zip', size: '3.4 MB', mod: '2026-11-20 22:31' } },
  { t: '22:33', type: 'log', log: { time: '22:33:50', lv: 'info', src: '파일 시스템', text: '복사 완료: ledger_backup.zip → E:\\' } },
  { t: '23:00', type: 'log', log: { time: '23:00:04', lv: 'warn', src: '보안', clue: 'perm', text: '권한 변경: han.seojin · ledger_prod 읽기 권한 제거 · 요청 moon.tk' } },
  { t: '23:49', type: 'log', log: { time: '23:49:30', lv: 'info', src: 'USB', text: '이동식 저장 장치를 안전하게 제거했습니다 (E:).' } },
  { t: '23:49', type: 'usb', on: false },
  { t: '23:55', type: 'log', log: { time: '23:55:19', lv: 'crit', src: 'MDM', clue: 'mdmlog', text: '원격 명령 수신: WIPE · 계정 kang.jh · 발신 기기 QA-HARIN-01 (10.0.4.17)' } },
  { t: '23:58', type: 'log', log: { time: '23:58:12', lv: 'crit', src: 'MDM', text: '원격 초기화를 시작합니다. 모든 사용자 데이터가 삭제됩니다.' } },
  { t: '23:58', type: 'wipe' },
];
EVENTS.forEach(e => { e.m = tm(e.t); });
EVENTS.sort((a, b) => a.m - b.m);

const COUNT = {
  msg: EVENTS.filter(e => e.type === 'msg').length,
  mail: EVENTS.filter(e => e.type === 'mail').length,
  log: EVENTS.filter(e => e.type === 'log').length,
};

const BOOT_TIPS = [
  '중요해 보이는 것은 직접 📌 핀을 꽂아야 노트에 남습니다. 글 속 단어는 눌러서 모읍니다.',
  '창은 여러 개 띄울 수 있습니다. 하지만 모든 것을 동시에 볼 수는 없습니다.',
  '수사 노트를 여는 동안에는 재생이 멈춥니다. 아래 타임라인의 호박색 표시는 이미 알아낸 사건의 시각입니다.',
  '이전 회차에서 알아낸 것은 이번 회차에서 바로 쓸 수 있습니다. 비밀번호처럼.',
  '놓친 것은 기록에서 사라지지 않습니다. 다만 당신이 보지 않았을 뿐입니다.',
];


/* ---------------------------------------------------------
   3. 아이콘과 사진
   --------------------------------------------------------- */

const PAGE = (extra, fold = '#c9d1dc') =>
  '<path d="M11 4h18l10 10v28a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" fill="url(#g-paper)" stroke="#b5bfcc" stroke-width=".8"/>' +
  `<path d="M29 4v8a2 2 0 0 0 2 2h8z" fill="${fold}"/>` + extra;

const ICONS = {
  // 노란 폴더 (뒤판 + 앞판)
  folder: '<path d="M4 11a3 3 0 0 1 3-3h11l4 4h19a3 3 0 0 1 3 3v24a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3z" fill="url(#g-folder-back)"/>' +
    '<path d="M4 18a3 3 0 0 1 3-3h34a3 3 0 0 1 3 3v21a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3z" fill="url(#g-folder)"/>' +
    '<path d="M4.5 18.5h39" stroke="#fff3c4" stroke-opacity=".8"/>',
  // 링크톡: 초록 말풍선
  chat: '<path d="M24 6C13.5 6 5 12.9 5 21.4c0 5.3 3.3 10 8.4 12.8L12 41.5l8.3-4.6c1.2.2 2.4.3 3.7.3 10.5 0 19-6.9 19-15.4S34.5 6 24 6z" fill="url(#g-chat)"/>' +
    '<path d="M24 6C13.5 6 5 12.9 5 21.4c0 1 .1 2 .4 2.9C7.2 15.7 14.900 9.6 24 9.6s16.8 6.100 18.6 14.7c.3-.9.4-1.9.4-2.9C43 12.9 34.5 6 24 6z" fill="#fff" opacity=".18"/>' +
    '<rect x="15" y="17" width="18" height="2.6" rx="1.3" fill="#fff"/><rect x="15" y="23" width="12" height="2.6" rx="1.3" fill="#fff" opacity=".85"/>',
  // 메일: 열린 봉투
  mail: '<rect x="5" y="12" width="38" height="27" rx="3" fill="url(#g-mail)"/>' +
    '<path d="M5.5 14.5 24 28l18.5-13.5" fill="none" stroke="#cfe8ff" stroke-width="2.2" stroke-linejoin="round"/>' +
    '<path d="M5 36.5 18 25M43 36.5 30 25" stroke="#0b5fb8" stroke-width="1.6" opacity=".6"/>',
  // 이벤트 뷰어: 기록지 + 수준 표시
  log: '<rect x="8" y="5" width="32" height="38" rx="2.5" fill="url(#g-ev)" stroke="#9aa3ae" stroke-width=".8"/>' +
    '<rect x="8" y="5" width="32" height="7" rx="2.5" fill="#4a78b8"/>' +
    '<circle cx="14" cy="19" r="2.6" fill="#2f7fd8"/><rect x="19" y="17.8" width="16" height="2.4" rx="1.2" fill="#8c96a3"/>' +
    '<path d="M14 24.6l3 5.2h-6z" fill="#f2b400"/><rect x="19" y="26" width="13" height="2.4" rx="1.2" fill="#8c96a3"/>' +
    '<circle cx="14" cy="35" r="2.6" fill="#d83b3b"/><rect x="19" y="33.8" width="15" height="2.4" rx="1.2" fill="#8c96a3"/>',
  txt: PAGE('<g fill="#7d8896"><rect x="14" y="19" width="20" height="1.8" rx=".9"/><rect x="14" y="24" width="20" height="1.8" rx=".9"/><rect x="14" y="29" width="16" height="1.8" rx=".9"/><rect x="14" y="34" width="18" height="1.8" rx=".9"/></g>'),
  pdf: PAGE('<rect x="6" y="25" width="24" height="12" rx="1.5" fill="#d93025"/><text x="18" y="34" text-anchor="middle" font-size="8.5" font-weight="700" fill="#fff" font-family="Segoe UI, sans-serif">PDF</text>'),
  csv: PAGE('<rect x="13" y="18" width="22" height="20" fill="#fff" stroke="#21a366" stroke-width="1.2"/><path d="M13 23h22M13 28h22M13 33h22M20 18v20M27 18v20" stroke="#21a366" stroke-width="1"/><rect x="13" y="18" width="22" height="5" fill="#21a366"/>'),
  img: PAGE('<rect x="13" y="18" width="22" height="18" rx="1" fill="url(#g-photo)"/><circle cx="29" cy="22.5" r="2.2" fill="#fff6c2"/><path d="M13 36l7-8 5 5 3-3 7 6z" fill="#3c8d3a"/>'),
  // 압축 폴더: 노란 폴더 + 지퍼
  zip: '<path d="M4 11a3 3 0 0 1 3-3h11l4 4h19a3 3 0 0 1 3 3v24a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3z" fill="url(#g-folder-back)"/>' +
    '<path d="M4 18a3 3 0 0 1 3-3h34a3 3 0 0 1 3 3v21a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3z" fill="url(#g-folder)"/>' +
    '<rect x="20" y="15" width="8" height="27" fill="#4a4a4a"/><g fill="#d9d9d9"><rect x="21" y="16" width="3" height="2"/><rect x="24" y="19" width="3" height="2"/><rect x="21" y="22" width="3" height="2"/><rect x="24" y="25" width="3" height="2"/></g>' +
    '<rect x="21" y="28" width="6" height="7" rx="1" fill="#c9c9c9" stroke="#333" stroke-width=".8"/>',
  // 휴지통 (안에 종이가 들어 있음)
  trash: '<path d="M10 14h28l-3 28a2 2 0 0 1-2 2H15a2 2 0 0 1-2-2z" fill="url(#g-bin)" stroke="#8fa0b3" stroke-width="1"/>' +
    '<path d="M16 14l4-6 6 4 5-5 3 7z" fill="#fff" stroke="#c3ccd6" stroke-width=".8"/>' +
    '<path d="M17 19l1.5 20M24 19v20M31 19l-1.5 20" stroke="#9fb0c2" stroke-width="1.2" opacity=".7"/>' +
    '<ellipse cx="24" cy="14" rx="14" ry="2" fill="none" stroke="#8fa0b3" stroke-width="1"/>',
  usb: '<rect x="17" y="4" width="14" height="10" rx="1" fill="#c9ced6"/><rect x="20" y="7" width="3" height="3" fill="#6b7280"/><rect x="25" y="7" width="3" height="3" fill="#6b7280"/>' +
    '<rect x="13" y="13" width="22" height="31" rx="4" fill="url(#g-usb)"/><rect x="17" y="37" width="14" height="2" rx="1" fill="#22c55e"/>',
  pc: '<rect x="5" y="8" width="38" height="25" rx="2" fill="#2b5c9e"/><rect x="7" y="10" width="34" height="21" fill="url(#g-photo)"/><rect x="20" y="33" width="8" height="5" fill="#7d8896"/><rect x="14" y="38" width="20" height="3" rx="1.5" fill="#9aa3ae"/>',
  navDesk: '<rect x="5" y="9" width="38" height="25" rx="2" fill="#2a7fd4"/><rect x="7" y="11" width="34" height="19" fill="#5fb2ff"/><rect x="18" y="36" width="12" height="4" rx="1" fill="#2a7fd4"/>',
  navDown: '<circle cx="24" cy="24" r="18" fill="#1aa260"/><path d="M24 13v17M16 23l8 8 8-8" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 35h18" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/>',
  navDocs: '<path d="M11 5h18l10 10v28H11z" fill="#4a8fe0"/><path d="M29 5v10h10z" fill="#9cc6f5"/><g fill="#fff"><rect x="16" y="22" width="16" height="2" rx="1"/><rect x="16" y="27" width="16" height="2" rx="1"/><rect x="16" y="32" width="11" height="2" rx="1"/></g>',
  navPics: '<rect x="5" y="9" width="38" height="30" rx="3" fill="#2f86d6"/><circle cx="16" cy="19" r="3.5" fill="#fff6c2"/><path d="M5 35l12-12 8 8 6-5 12 10v0a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3z" fill="#9fd4ff"/>',
  lock: '<path d="M15 21v-6a9 9 0 0 1 18 0v6" fill="none" stroke="#8a8f98" stroke-width="4"/><rect x="10" y="20" width="28" height="23" rx="3" fill="#f2b400"/><rect x="10" y="20" width="28" height="5" fill="#ffd34d"/><circle cx="24" cy="31" r="3" fill="#5a4300"/><rect x="23" y="32" width="2" height="6" fill="#5a4300"/>',
  info: '<circle cx="24" cy="24" r="19" fill="#0067c0"/><rect x="22" y="21" width="4" height="13" rx="1.5" fill="#fff"/><circle cx="24" cy="15" r="2.6" fill="#fff"/>',
  notes: '<rect x="6" y="6" width="36" height="36" rx="9" fill="#fff"/><rect x="6" y="6" width="36" height="11" rx="9" fill="url(#g-notes)"/><rect x="6" y="12" width="36" height="5" fill="url(#g-notes)"/>' +
    '<g stroke="#d6d6d6" stroke-width="1.4"><path d="M12 25h24M12 31h24M12 37h18"/></g>',
  term: '<rect x="5" y="7" width="38" height="34" rx="7" fill="#2d2d2f"/><rect x="5" y="7" width="38" height="34" rx="7" fill="none" stroke="#5a5a5e"/><path d="M13 19l6 5-6 5" fill="none" stroke="#e5e5e5" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M22 30h11" stroke="#e5e5e5" stroke-width="2.4" stroke-linecap="round"/>',
};

function icon(name, size = 40) {
  return `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 48 48" aria-hidden="true">${ICONS[name] || ICONS.txt}</svg>`;
}

const SVG_MIN = '<svg width="10" height="10" viewBox="0 0 10 10"><path d="M0 5.5h10" stroke="currentColor" stroke-width="1"/></svg>';
const SVG_MAX = '<svg width="10" height="10" viewBox="0 0 10 10"><rect x=".5" y=".5" width="9" height="9" rx="1.5" fill="none" stroke="currentColor" stroke-width="1"/></svg>';
const SVG_X = '<svg width="10" height="10" viewBox="0 0 10 10"><path d="M.5.5l9 9M9.5.5l-9 9" stroke="currentColor" stroke-width="1"/></svg>';
const SVG_PIN = '<svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 3l6 6-3 1-4 4 .5 4.5L13 20l-4-4-5 5-1-1 5-5-4-4 1.5-1.5L10 10l4-4z" fill="currentColor"/></svg>';
const SVG_WARN = '<svg width="34" height="34" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8 22.4 20.5H1.6z" fill="#ff4d5e"/><rect x="11" y="9" width="2" height="6.5" rx="1" fill="#2a0006"/><circle cx="12" cy="18" r="1.3" fill="#2a0006"/></svg>';

// 사진 (SVG로 그린 그림)
const STAMP = (txt) => `<text x="606" y="396" text-anchor="end" font-family="JetBrains Mono, monospace" font-size="21" font-weight="700" fill="#ff8a2a" opacity=".92" style="paint-order:stroke" stroke="#ff8a2a" stroke-opacity=".25" stroke-width="4">${txt}</text>`;
const VIGNETTE = id => `<radialGradient id="${id}" cx=".5" cy=".5" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".5"/></radialGradient>`;

const PHOTOS = (() => {
  // 실제 사진 위에 디카 날짜 각인과 빨간 동그라미를 덧씌움
  // 사진을 못 불러오면 원래 SVG 그림(fallback)을 대신 보여 줌
  const pic = ({ src, alt, stamp, mark, fallback }) => `
    <div style="position:relative;width:100%;height:100%;background:#000">
      <img src="${src}" alt="${alt}" style="display:block;width:100%;height:100%;object-fit:cover"
           onerror="this.parentNode.innerHTML=this.parentNode.querySelector('template').innerHTML">
      ${mark ? `<i style="position:absolute;left:${mark.x};top:${mark.y};width:${mark.w};height:${mark.h};border:3px solid rgba(255,59,59,.85);border-radius:50%;transform:rotate(-8deg)"></i>` : ''}
      ${stamp ? `<span style="position:absolute;right:4%;bottom:5%;font:700 20px var(--mono);color:#ff8a2a;text-shadow:0 0 6px rgba(255,138,42,.6);letter-spacing:.04em">${stamp}</span>` : ''}
      <template>${fallback}</template>
    </div>`;

  const SVG_HOUSE = `<svg viewBox="0 0 640 420" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="ph-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6fa9d8"/><stop offset=".75" stop-color="#d8e8d6"/></linearGradient>
        <linearGradient id="ph-yard" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d4bf93"/><stop offset="1" stop-color="#b79c6c"/></linearGradient>
        ${VIGNETTE('ph-vig')}
      </defs>
      <rect width="640" height="420" fill="url(#ph-sky)"/>
      <g fill="#fff" opacity=".75"><ellipse cx="130" cy="64" rx="74" ry="16"/><ellipse cx="178" cy="54" rx="40" ry="14"/><ellipse cx="470" cy="90" rx="60" ry="12"/></g>
      <path d="M0 246C70 168 130 186 186 214 248 158 304 150 362 198 424 166 500 136 560 186 600 172 620 182 640 192V420H0Z" fill="#82a983"/>
      <path d="M0 272C90 230 160 248 240 262 330 230 420 238 520 254 580 246 620 250 640 254V420H0Z" fill="#5c8a61"/>
      <rect y="300" width="640" height="120" fill="url(#ph-yard)"/>
      <path d="M0 300H640" stroke="#a88f60" stroke-width="2"/>
      <g fill="#6b4529"><ellipse cx="44" cy="330" rx="20" ry="9"/><ellipse cx="80" cy="336" rx="16" ry="8"/><ellipse cx="62" cy="352" rx="22" ry="10"/></g>
      <g fill="#8a5a35"><path d="M26 330q18-30 36 0z"/><path d="M66 336q14-24 28 0z"/><path d="M42 352q20-34 40 0z"/></g>
      <path d="M58 312C60 272 54 252 70 222" stroke="#5a3d26" stroke-width="11" fill="none" stroke-linecap="round"/>
      <path d="M66 240C84 232 96 226 112 214" stroke="#5a3d26" stroke-width="6" fill="none" stroke-linecap="round"/>
      <g fill="#4d7a45"><circle cx="70" cy="200" r="40"/><circle cx="112" cy="206" r="30"/><circle cx="36" cy="214" r="26"/></g>
      <g fill="#5f904f"><circle cx="84" cy="188" r="26"/><circle cx="50" cy="196" r="20"/></g>
      <g fill="#ff8c2a"><circle cx="58" cy="210" r="4.5"/><circle cx="94" cy="196" r="4.5"/><circle cx="112" cy="220" r="4.5"/><circle cx="74" cy="226" r="4"/><circle cx="40" cy="224" r="4"/><circle cx="102" cy="178" r="4"/></g>
      <rect x="128" y="232" width="250" height="70" fill="#efe4cc"/>
      <g fill="#6b4a2f"><rect x="128" y="232" width="7" height="70"/><rect x="190" y="232" width="7" height="70"/><rect x="252" y="232" width="7" height="70"/><rect x="314" y="232" width="7" height="70"/><rect x="371" y="232" width="7" height="70"/></g>
      <g fill="#dccba7" stroke="#6b4a2f" stroke-width="2"><rect x="200" y="248" width="48" height="40"/><rect x="262" y="248" width="48" height="40"/></g>
      <g stroke="#6b4a2f" stroke-width="1.2"><path d="M224 248v40M200 268h48M286 248v40M262 268h48"/></g>
      <rect x="118" y="300" width="270" height="11" fill="#8d8371"/>
      <path d="M92 238Q106 226 126 222H380Q400 226 414 238L402 200Q253 182 104 200Z" fill="#3f4753"/>
      <g stroke="#2a3038" stroke-width="2" fill="none"><path d="M108 210Q253 192 398 210"/><path d="M100 224Q253 206 406 224"/></g>
      <path d="M150 196Q253 178 356 196L348 186Q253 170 158 186Z" fill="#2a3038"/>
      <rect x="436" y="216" width="120" height="88" fill="#a97f52"/>
      <g stroke="#8a6440" stroke-width="2"><path d="M456 216v88M476 216v88M516 216v88M536 216v88"/></g>
      <path d="M424 222 496 176 568 222Z" fill="#5b4a3d"/>
      <path d="M424 222 496 176 568 222" fill="none" stroke="#463a30" stroke-width="3"/>
      <rect x="484" y="196" width="24" height="16" fill="#25190f" stroke="#ecdfc3" stroke-width="2"/>
      <rect x="474" y="250" width="40" height="54" fill="#6b4a2f"/>
      <path d="M470 186C500 176 528 190 524 206 520 222 482 224 468 210 458 198 470 188 486 186" fill="none" stroke="#ff3b3b" stroke-width="3.4" stroke-linecap="round" opacity=".85"/>
      <g><circle cx="404" cy="290" r="7" fill="#2b1d16"/><path d="M396 298h16l4 22h-24z" fill="#e85d75"/><rect x="398" y="320" width="4" height="10" fill="#f0c7a3"/><rect x="406" y="320" width="4" height="10" fill="#f0c7a3"/></g>
      <g><circle cx="424" cy="298" r="6" fill="#2b1d16"/><rect x="418" y="305" width="12" height="15" rx="2" fill="#3d7dd6"/><rect x="419" y="320" width="4" height="10" fill="#2b3a55"/><rect x="425" y="320" width="4" height="10" fill="#2b3a55"/></g>
      <rect width="640" height="420" fill="#ffb060" opacity=".08"/>
      <rect width="640" height="420" fill="url(#ph-vig)"/>
      ${STAMP("'09 7 26")}
    </svg>`;
  const SVG_ATTIC = `<svg viewBox="0 0 640 420" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="pa-beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe7a8" stop-opacity=".34"/><stop offset="1" stop-color="#ffe7a8" stop-opacity="0"/></linearGradient>
        <radialGradient id="pa-win" cx=".5" cy=".5" r=".6"><stop offset="0" stop-color="#fff6d6"/><stop offset="1" stop-color="#ffd27a"/></radialGradient>
        ${VIGNETTE('pa-vig')}
      </defs>
      <rect width="640" height="420" fill="#24170e"/>
      <polygon points="0,0 320,92 110,420 0,420" fill="#3a2718"/>
      <polygon points="640,0 320,92 530,420 640,420" fill="#33221a"/>
      <polygon points="110,420 320,92 530,420" fill="#4b3322"/>
      <g stroke="#1c120a" stroke-width="10" stroke-linecap="round"><path d="M320 92 30 420M320 92 610 420M320 92 0 160M320 92 640 160"/></g>
      <g stroke="#5e412b" stroke-width="2" opacity=".6"><path d="M160 420 320 120M480 420 320 120M240 420 320 160M400 420 320 160"/></g>
      <rect x="292" y="196" width="56" height="42" rx="2" fill="url(#pa-win)"/>
      <path d="M320 196v42M292 217h56" stroke="#6b4a2f" stroke-width="4"/>
      <rect x="292" y="196" width="56" height="42" fill="none" stroke="#6b4a2f" stroke-width="5"/>
      <polygon points="292,238 348,238 470,420 200,420" fill="url(#pa-beam)"/>
      <g fill="#fff2c8" opacity=".7"><circle cx="300" cy="280" r="1.6"/><circle cx="336" cy="300" r="1.2"/><circle cx="318" cy="330" r="1.8"/><circle cx="352" cy="352" r="1.2"/><circle cx="286" cy="316" r="1"/><circle cx="372" cy="270" r="1.3"/></g>
      <rect y="356" width="640" height="64" fill="#5a3d26"/>
      <g stroke="#3e2919" stroke-width="2"><path d="M0 372H640M0 392H640M0 410H640"/></g>
      <rect x="134" y="330" width="190" height="52" rx="22" fill="#b84a47"/>
      <g stroke="#e8b3a0" stroke-width="3" opacity=".7"><path d="M150 346h158M150 362h158"/></g>
      <rect x="150" y="318" width="60" height="26" rx="12" fill="#e9e1cf"/>
      <g><rect x="410" y="348" width="64" height="10" fill="#3f7fe0"/><rect x="414" y="338" width="58" height="10" fill="#e85d75"/><rect x="408" y="328" width="62" height="10" fill="#f2c46a"/><rect x="412" y="318" width="56" height="10" fill="#45d49a"/></g>
      <g transform="rotate(-18 506 352)"><rect x="486" y="346" width="40" height="12" rx="4" fill="#2d3446"/><rect x="524" y="343" width="9" height="18" rx="2" fill="#4f5a78"/></g>
      <g transform="rotate(-4 420 150)">
        <rect x="372" y="118" width="120" height="74" fill="#f3ecd8"/>
        <rect x="372" y="118" width="120" height="74" fill="none" stroke="#d8ccb0"/>
        <text x="432" y="152" text-anchor="middle" font-size="22" font-weight="900" fill="#d23b3b" font-family="Noto Sans KR, sans-serif">비밀기지</text>
        <text x="432" y="176" text-anchor="middle" font-size="11" font-weight="700" fill="#3d7dd6" font-family="Noto Sans KR, sans-serif">서진·도윤 외 출입금지</text>
        <circle cx="432" cy="122" r="3" fill="#888"/>
      </g>
      <rect width="640" height="420" fill="#ff9040" opacity=".07"/>
      <rect width="640" height="420" fill="url(#pa-vig)"/>
      ${STAMP("'09 7 26")}
    </svg>`;
  const SVG_SEA = `<svg viewBox="0 0 640 420" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="ps-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2f2f6e"/><stop offset=".45" stop-color="#a5618f"/><stop offset=".72" stop-color="#f5a77d"/></linearGradient>
        <linearGradient id="ps-sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5b5f9c"/><stop offset="1" stop-color="#1f2350"/></linearGradient>
        <linearGradient id="ps-sand" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c79f7d"/><stop offset="1" stop-color="#7a5a48"/></linearGradient>
        <radialGradient id="ps-sun" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff1c9"/><stop offset=".45" stop-color="#ffd08a" stop-opacity=".9"/><stop offset="1" stop-color="#ff9a6a" stop-opacity="0"/></radialGradient>
        ${VIGNETTE('ps-vig')}
      </defs>
      <rect width="640" height="420" fill="url(#ps-sky)"/>
      <circle cx="410" cy="252" r="90" fill="url(#ps-sun)"/>
      <circle cx="410" cy="252" r="26" fill="#fff0c8"/>
      <rect y="258" width="640" height="100" fill="url(#ps-sea)"/>
      <g stroke="#ffd9a0" stroke-linecap="round" opacity=".75"><path d="M380 270h60M390 282h40M372 294h74M396 306h28M386 320h46" stroke-width="3"/></g>
      <g stroke="#b9bde8" stroke-width="1.5" opacity=".35" fill="none"><path d="M0 300q40-6 80 0t80 0 80 0"/><path d="M200 330q40-6 80 0t80 0 80 0"/><path d="M460 312q40-6 80 0t80 0"/></g>
      <path d="M520 262h120v12H520z" fill="#2a2440"/>
      <rect x="586" y="206" width="18" height="58" fill="#d6453f"/><rect x="583" y="200" width="24" height="8" fill="#f3ecd8"/><rect x="589" y="190" width="12" height="12" fill="#ffe7a8"/><path d="M586 190h18l-9-9z" fill="#d6453f"/>
      <path d="M0 352Q160 336 320 348T640 344V420H0Z" fill="url(#ps-sand)"/>
      <g fill="#2a2440"><circle cx="230" cy="324" r="8"/><path d="M220 332q10-4 20 0l4 22h-28z"/><circle cx="256" cy="326" r="7.5"/><path d="M247 333q9-4 18 0l4 21h-26z"/></g>
      <rect width="640" height="420" fill="url(#ps-vig)"/>
    </svg>`;

  return {
    house: {
      clue: 'photo', date: '2009-07-26 15:22 · DSC-W80',
      desc: '여름방학, 제천 할머니 집. 오른쪽 창고 위 다락이 우리 비밀기지. (빨간 동그라미는 2019년에 내가 그린 거)',
      svg: pic({
        src: 'photo/2009_제천_할머니집.jpg',
        alt: '제천 할머니 집',
        mark: { x: '81.5%', y: '9%', w: '11%', h: '17%' },   // 창고 위 다락 창문
        fallback: SVG_HOUSE,
      }),
    },
    attic: {
      clue: 'photo', date: '2009-07-26 16:05 · DSC-W80',
      desc: '사다리 치우면 아무도 못 올라옴. 도윤이 처음엔 엄청 무서워했음 ㅋㅋ',
      svg: pic({
        src: 'photo/2009_비밀기지.jpg',
        alt: '다락 비밀기지',
        fallback: SVG_ATTIC,
      }),
    },
    sea: {
      clue: null, date: '2021-06-19 19:48 · 필름 카메라 앱',
      desc: '회사 워크숍, 강릉. 하린이랑 처음 제대로 얘기한 날. 둘이 빠져나와서 해 지는 거 봤다.',
      svg: pic({
        src: 'photo/2021_강릉_워크숍.jpg',
        alt: '강릉 바다',
        fallback: SVG_SEA,
      }),
    },
  };
})();


/* ---------------------------------------------------------
   3-1. 효과음 (음원 파일 없이 Web Audio로 직접 만듦)
   --------------------------------------------------------- */

const Sound = (() => {
  let ctx = null;
  let master, sfxBus, rainBus, rainFilter, droneGain, noise;
  let tension = 0;

  // 2초짜리 분홍 잡음 (빗소리, 종이 소리, 하드디스크 소리의 재료)
  function makeNoise() {
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i += 1) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.099046;
      b1 = 0.963 * b1 + w * 0.2965164;
      b2 = 0.57 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.18;
    }
    return buf;
  }

  // 브라우저 정책상 첫 클릭이나 키 입력 뒤에만 소리를 켤 수 있음
  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { ctx = new AC(); } catch (e) { ctx = null; return; }

    master = ctx.createGain();
    master.gain.value = save.sound ? 1 : 0;
    master.connect(ctx.destination);
    sfxBus = ctx.createGain();
    sfxBus.gain.value = 0.8;
    sfxBus.connect(master);
    noise = makeNoise();

    // 빗소리
    const rain = ctx.createBufferSource();
    rain.buffer = noise;
    rain.loop = true;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 380;
    rainFilter = ctx.createBiquadFilter();
    rainFilter.type = 'lowpass';
    rainFilter.frequency.value = 2400;
    rainBus = ctx.createGain();
    rainBus.gain.value = 0;
    rain.connect(hp).connect(rainFilter).connect(rainBus).connect(master);
    rain.start();
    rainBus.gain.linearRampToValueAtTime(0.16, ctx.currentTime + 3);

    // 창에 부딪히는 빗방울 (높은 대역, 천천히 흔들림)
    const drip = ctx.createBufferSource();
    drip.buffer = noise;
    drip.loop = true;
    drip.playbackRate.value = 0.7;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 5200;
    bp.Q.value = 1.2;
    const dg = ctx.createGain();
    dg.gain.value = 0.05;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.13;
    const lg = ctx.createGain();
    lg.gain.value = 0.025;
    lfo.connect(lg).connect(dg.gain);
    lfo.start();
    drip.connect(bp).connect(dg).connect(rainBus);
    drip.start();

    // 자정이 다가오면 깔리는 낮은 울림
    droneGain = ctx.createGain();
    droneGain.gain.value = 0;
    droneGain.connect(master);
    [55, 82.4, 110.6].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = i ? 'sine' : 'triangle';
      o.frequency.value = f;
      o.detune.value = i * 6;
      o.connect(droneGain);
      o.start();
    });
  }

  // 짧은 음
  function tone(freq, dur, { type = 'sine', vol = 0.1, at = 0, to = null, attack = 0.005 } = {}) {
    const t = ctx.currentTime + at;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(sfxBus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  // 짧은 잡음
  function hiss(dur, { freq = 2000, q = 1, type = 'bandpass', vol = 0.1, at = 0 } = {}) {
    const t = ctx.currentTime + at;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(sfxBus);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.05);
  }

  const SFX = {
    msg: () => { tone(988, 0.12, { vol: 0.09 }); tone(1319, 0.18, { vol: 0.08, at: 0.08 }); },
    mail: () => [784, 988, 1175].forEach((f, i) => tone(f, 0.3, { type: 'triangle', vol: 0.05, at: i * 0.07 })),
    clue: () => {                                   // 연필로 적는 소리 + 맑은 두 음
      hiss(0.05, { freq: 3500, vol: 0.05 });
      hiss(0.07, { freq: 2800, vol: 0.04, at: 0.07 });
      tone(660, 0.25, { type: 'triangle', vol: 0.05, at: 0.1 });
      tone(880, 0.3, { type: 'triangle', vol: 0.04, at: 0.18 });
    },
    open: () => tone(520, 0.08, { vol: 0.035, to: 760 }),
    close: () => tone(700, 0.08, { vol: 0.03, to: 420 }),
    pick: () => hiss(0.03, { freq: 2500, type: 'highpass', vol: 0.06 }),
    page: () => hiss(0.12, { freq: 1800, vol: 0.05 }),
    key: () => {                                    // 하린이 입력하는 키보드 소리
      for (let i = 0; i < 7; i += 1) hiss(0.025, { freq: 2600 + Math.random() * 1500, vol: 0.05, at: i * (0.1 + Math.random() * 0.12) });
    },
    remove: () => tone(620, 0.22, { vol: 0.06, to: 180 }),
    error: () => { tone(140, 0.2, { type: 'sawtooth', vol: 0.05 }); tone(132, 0.22, { type: 'sawtooth', vol: 0.04, at: 0.02 }); },
    reject: () => {                                 // 반려 도장
      hiss(0.12, { freq: 300, type: 'lowpass', vol: 0.3 });
      tone(220, 0.25, { type: 'square', vol: 0.03, at: 0.05 });
      tone(165, 0.35, { type: 'square', vol: 0.03, at: 0.2 });
    },
    unlock: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, { type: 'triangle', vol: 0.06, at: i * 0.06 })),
    connect: () => {                                // 실을 퉁기는 소리 + 화음
      tone(196, 0.5, { type: 'triangle', vol: 0.12, attack: 0.002 });
      tone(392, 0.4, { vol: 0.05, attack: 0.002 });
      [523, 659, 784].forEach((f, i) => tone(f, 0.6, { vol: 0.05, at: 0.55 + i * 0.05 }));
    },
    stamp: () => {                                  // 승인 도장
      hiss(0.18, { freq: 220, type: 'lowpass', vol: 0.6 });
      tone(70, 0.3, { vol: 0.25 });
      [392, 523, 659].forEach((f, i) => tone(f, 0.8, { type: 'triangle', vol: 0.05, at: 0.3 + i * 0.08 }));
    },
    twist: () => {                                  // 반전: 낮은 충격음 + 불협화음
      tone(41, 2.5, { vol: 0.35, attack: 0.01 });
      hiss(1.2, { freq: 160, type: 'lowpass', vol: 0.4 });
      tone(233, 2.2, { type: 'triangle', vol: 0.05, at: 0.3, attack: 0.4 });
      tone(330, 2.2, { type: 'triangle', vol: 0.04, at: 0.3, attack: 0.4 });
    },
    alarm: () => {
      for (let i = 0; i < 3; i += 1) {
        tone(880, 0.16, { type: 'square', vol: 0.03, at: i * 0.4 });
        tone(660, 0.16, { type: 'square', vol: 0.03, at: i * 0.4 + 0.2 });
      }
    },
    hdd: () => {                                    // 지워지는 하드디스크
      hiss(0.03, { freq: 1500 + Math.random() * 2000, q: 4, vol: 0.12 });
      if (Math.random() < 0.5) hiss(0.02, { freq: 4000, q: 6, vol: 0.08, at: 0.05 });
    },
    beat: () => { tone(58, 0.16, { vol: 0.3 }); tone(52, 0.2, { vol: 0.24, at: 0.22 }); },
    lost: () => { hiss(1.3, { freq: 3000, type: 'highpass', q: 0.5, vol: 0.18 }); tone(60, 0.6, { type: 'sawtooth', vol: 0.06, to: 30 }); },
    beep: () => tone(1000, 0.14, { type: 'square', vol: 0.03 }),
    start: () => { tone(330, 0.4, { vol: 0.05, to: 660 }); tone(495, 0.5, { vol: 0.03, at: 0.1, to: 990 }); },
    ending: () => [262, 330, 392, 523, 659, 784].forEach((f, i) => tone(f, 1.6, { vol: 0.05, at: i * 0.22, attack: 0.05 })),
  };

  function sfx(name) {
    if (!ctx || !save.sound || !SFX[name]) return;
    try { SFX[name](); } catch (e) { /* 소리 실패는 게임에 영향 없음 */ }
  }

  // 23:50부터 낮은 울림이 커짐
  function setTension(t) {
    if (!ctx) return;
    const v = t >= WIPE_AT ? 0.09 : t >= 110 ? 0.02 + (t - 110) / 8 * 0.05 : 0;
    if (Math.abs(v - tension) < 0.002) return;
    tension = v;
    droneGain.gain.setTargetAtTime(v, ctx.currentTime, 0.5);
  }

  // 수사 노트(가상 PC 바깥)를 열면 PC 쪽 소리가 먹먹해짐
  function muffle(on) {
    if (!ctx) return;
    rainFilter.frequency.setTargetAtTime(on ? 500 : 2400, ctx.currentTime, 0.15);
    rainBus.gain.setTargetAtTime(on ? 0.07 : 0.16, ctx.currentTime, 0.2);
    droneGain.gain.setTargetAtTime(on ? tension * 0.3 : tension, ctx.currentTime, 0.2);
  }

  function setOn(on) {
    if (ctx) master.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 0.05);
  }

  return { init, sfx, setTension, muffle, setOn };
})();


/* ---------------------------------------------------------
   4. 상태와 저장
   --------------------------------------------------------- */

function defaultSave() {
  return { loop: 1, clues: {}, words: {}, deds: {}, stage: 0, intro: false, solved: false, reports: 0, misses: 0, memo: '', answers: {}, sound: true };
}

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? Object.assign(defaultSave(), JSON.parse(raw)) : defaultSave();
  } catch (e) {
    return defaultSave();
  }
}

function persist() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* 저장 불가 환경: 무시 */ }
}

// 회차마다 처음으로 돌아가는 가상 PC 상태
function freshVM() {
  const msgs = {};
  CHATS.forEach(c => { msgs[c.id] = c.history.map(m => ({ ...m })); });
  return {
    t: 0,
    ev: 0,
    msgs,
    unread: { harin: 0, family: 0, team: 0 },
    typing: {},
    mails: MAILS0.map(m => ({ ...m })),
    mailRead: new Set(MAILS0.filter(m => m.read).map(m => m.id)),
    logs: LOGS0.map(l => ({ ...l })),
    files: JSON.parse(JSON.stringify(FILES0)),
    usb: false,
    unlocked: false,
    wiping: false,
    wipeN: 0,
  };
}

let save = loadSave();
let vm = freshVM();
let speed = 1;
let running = false;
let paused = false;
let transitioning = false;
let lastFrame = performance.now();
let lastMinute = -1;
let notesOpen = false;
let notesTab = 'timeline';
let resetArmed = false;
let lastNotesTab = null;
const newClues = new Set();

const stage = $('#stage');


/* ---------------------------------------------------------
   5. 화면 크기 맞추기 (1280×760 화면을 창 크기에 맞춰 확대·축소)
   --------------------------------------------------------- */

let scale = 1;

function fit() {
  scale = Math.min(innerWidth / W, innerHeight / H);
  const x = (innerWidth - W * scale) / 2;
  const y = (innerHeight - H * scale) / 2;
  stage.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
}


/* ---------------------------------------------------------
   6. 창 관리
   --------------------------------------------------------- */

const APPS = {
  messenger: { title: '링크톡', icon: 'chat', w: 780, h: 540, x: 110, y: 36, cls: 'light brand', data: { chat: 'harin' }, render: renderMessenger },
  mail:      { title: '메일', icon: 'mail', w: 840, h: 520, x: 190, y: 60, data: { sel: null }, render: renderMail },
  explorer:  { title: '파일 탐색기', icon: 'folder', w: 800, h: 490, x: 240, y: 80, data: { dir: 'docs' }, render: renderExplorer },
  events:    { title: '이벤트 뷰어', icon: 'log', w: 880, h: 480, x: 160, y: 110, cls: 'light', data: { sel: null }, render: renderEvents },
  doc:       { title: '메모장', icon: 'txt', pin: true, w: 600, h: 470, x: 400, y: 50, render: renderDoc },
  photo:     { title: '사진', icon: 'img', pin: true, w: 700, h: 570, x: 320, y: 30, render: renderPhoto },
  zip:       { title: '암호 입력', icon: 'zip', pin: true, w: 430, h: 300, x: 425, y: 180, cls: 'light', dialog: true, render: renderZip },
  zipdir:    { title: 'ledger_backup', icon: 'zip', pin: true, w: 600, h: 260, x: 340, y: 160, render: renderZipDir },
  csv:       { title: '송금내역_요약.csv - 메모장', icon: 'txt', pin: true, w: 760, h: 400, x: 250, y: 120, render: renderCsv },
  dialog:    { title: '', icon: 'info', w: 440, h: 200, x: 420, y: 240, dialog: true, render: renderDialog },
};

const wins = new Map();
let zTop = 10;
let focusedId = null;

function openApp(app, opt = {}) {
  const id = opt.id || app;

  // 이미 열려 있으면 앞으로 가져오기
  if (wins.has(id)) {
    const w = wins.get(id);
    Object.assign(w.data, opt.data || {});
    if (w.min) { w.min = false; w.el.classList.remove('min'); }
    focusWin(w);
    renderWin(w);
    return w;
  }

  const def = APPS[app];
  const n = wins.size;
  const ww = opt.w || def.w;
  const hh = opt.h || def.h;
  const x = clamp((opt.x ?? def.x) + (n % 5) * 26, 8, W - ww - 8);
  const y = clamp((opt.y ?? def.y) + (n % 5) * 22, 8, H - TASKBAR - hh - 8);

  const el = document.createElement('section');
  el.className = 'win ' + (def.cls || '');
  el.dataset.id = id;
  el.style.cssText = `left:${x}px;top:${y}px;width:${ww}px;height:${hh}px`;
  const title = opt.title ?? def.title;
  const ic = opt.icon || def.icon;
  el.innerHTML = `
    <header class="titlebar">
      ${def.dialog ? '' : `<span class="tb-ic">${icon(ic, 16)}</span>`}
      <span class="tb-title">${esc(title)}</span>
      ${def.pin ? `<button class="cap pin" data-a="pin" data-kind="win" title="수사 노트에 꽂기" aria-label="수사 노트에 꽂기">${SVG_PIN}</button>` : ''}
      ${def.dialog ? '' : `<button class="cap" data-a="win-min" aria-label="최소화">${SVG_MIN}</button><button class="cap" data-a="win-max" aria-label="최대화">${SVG_MAX}</button>`}
      <button class="cap close" data-a="win-close" aria-label="닫기">${SVG_X}</button>
    </header>
    <div class="wbody"></div>`;
  $('#windows').appendChild(el);

  const w = { id, app, el, body: $('.wbody', el), title, icon: ic, min: false, data: { ...(def.data || {}), ...(opt.data || {}) } };
  wins.set(id, w);
  focusWin(w);
  renderWin(w);
  Sound.sfx('open');
  return w;
}

function focusWin(w) {
  if (!w) return;
  zTop += 1;
  w.el.style.zIndex = zTop;
  focusedId = w.id;
  wins.forEach(x => x.el.classList.toggle('focus', x === w));
  renderTaskbar();
}

function topVisible() {
  let best = null;
  wins.forEach(w => {
    if (!w.min && (!best || +w.el.style.zIndex > +best.el.style.zIndex)) best = w;
  });
  return best;
}

function minimizeWin(w) {
  w.min = true;
  w.el.classList.add('min');
  focusedId = null;
  const next = topVisible();
  if (next) focusWin(next); else renderTaskbar();
}

function closeWin(w) {
  Sound.sfx('close');
  wins.delete(w.id);
  w.el.classList.add('closing');
  setTimeout(() => w.el.remove(), 140);
  if (focusedId === w.id) {
    focusedId = null;
    const next = topVisible();
    if (next) focusWin(next);
  }
  renderTaskbar();
}

function closeAllWindows() {
  wins.forEach(w => w.el.remove());
  wins.clear();
  focusedId = null;
}

function winOf(el) {
  const box = el.closest('.win');
  return box ? wins.get(box.dataset.id) : null;
}

function rerender(app) {
  wins.forEach(w => { if (w.app === app) renderWin(w); });
}

// 다시 그려도 스크롤 위치가 튀지 않게
function renderWin(w) {
  const keep = {};
  const scrollers = ['.chat-log', '.ev-scroll', '.mail-list', '.exp-grid', '.np-text'];
  scrollers.forEach(sel => {
    const s = $(sel, w.body);
    if (s) keep[sel] = { top: s.scrollTop, bottom: s.scrollHeight - s.scrollTop - s.clientHeight < 48 };
  });

  const chatChanged = w.app === 'messenger' && w.lastChat !== w.data.chat;
  w.lastChat = w.data.chat;

  w.body.innerHTML = APPS[w.app].render(w);

  scrollers.forEach(sel => {
    const s = $(sel, w.body);
    if (!s) return;
    const k = keep[sel];
    const stick = sel === '.chat-log' || sel === '.ev-scroll';
    if (stick && (!k || k.bottom || chatChanged)) s.scrollTop = s.scrollHeight;
    else if (k) s.scrollTop = k.top;
  });

  observe();
}


/* ---------------------------------------------------------
   7. 앱 화면 그리기
   --------------------------------------------------------- */

function avatar(p, extra = '') {
  return `<span class="av ${extra}" style="--c:${p.color}">${p.ch}</span>`;
}

function chatAvatar(c) {
  if (!c.group) return avatar(PEOPLE[c.who]);
  return `<span class="av-grp">${avatar(PEOPLE[c.group[0]], 'a1')}${avatar(PEOPLE[c.group[1]], 'a2')}</span>`;
}

function isTyping(chat) {
  const ty = vm.typing[chat];
  return ty && vm.t < ty.until;
}

function chatVisible(chat) {
  for (const w of wins.values()) if (w.app === 'messenger' && !w.min && w.data.chat === chat) return true;
  return false;
}

/* 링크톡 (메신저) */
function renderMessenger(w) {
  const chat = w.data.chat;
  if (!w.min) vm.unread[chat] = 0;

  const list = CHATS.map(c => {
    const msgs = vm.msgs[c.id];
    const last = msgs[msgs.length - 1];
    const prev = isTyping(c.id) ? '<em>입력 중…</em>' : esc(last ? (last.deleted ? '삭제된 메시지입니다.' : last.text) : '');
    return `<button class="chat-item ${c.id === chat ? 'on' : ''}" data-a="chat" data-chat="${c.id}">
      ${chatAvatar(c)}
      <span class="ci-main">
        <span class="ci-top"><b>${esc(c.title)}</b>${c.count ? `<i>${c.count}</i>` : ''}<time>${last ? lastTime(last) : ''}</time></span>
        <span class="ci-prev">${prev}</span>
      </span>
      ${vm.unread[c.id] ? `<span class="badge">${vm.unread[c.id]}</span>` : ''}
    </button>`;
  }).join('');

  const c = CHATS.find(x => x.id === chat);
  let lastDay = null;
  let lastWho = null;
  const rows = vm.msgs[chat].map((m, idx) => {
    let html = '';
    if (m.day !== lastDay) {
      html += `<div class="day">${esc(m.day)}</div>`;
      lastDay = m.day;
      lastWho = null;
    }
    const p = PEOPLE[m.who];
    const me = m.who === 'seojin';
    const cont = lastWho === m.who;
    lastWho = m.who;
    const body = m.deleted
      ? '<svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7v6M12 16.5v.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg> 삭제된 메시지입니다.'
      : kw(esc(m.text));
    const pinned = m.clue && !m.deleted && save.clues[m.clue];
    const pin = m.deleted ? '' : `<button class="pin-btn ${pinned ? 'on' : ''}" data-a="pin" data-kind="msg" data-chat="${chat}" data-i="${idx}" title="수사 노트에 꽂기">${SVG_PIN}</button>`;
    html += `<div class="m ${me ? 'me' : ''} ${cont ? 'cont' : ''} ${m.deleted ? 'deleted' : ''} ${m.fresh && !w.min ? 'fresh' : ''}">
      ${me ? '' : (cont ? '<span class="av-gap"></span>' : avatar(p))}
      <div class="m-col">
        ${!me && !cont ? `<span class="who">${kw(esc(p.name))}</span>` : ''}
        <div class="m-row"><div class="bub">${body}</div><span class="meta">${m.unread ? '<i>1</i>' : ''}${kwTime(m.time, ampm(m.time))}</span>${pin}</div>
      </div>
    </div>`;
    if (!w.min) m.fresh = false;
    return html;
  }).join('');

  const typing = isTyping(chat)
    ? `<div class="m typing">${avatar(PEOPLE[vm.typing[chat].who])}<div class="m-col"><div class="m-row"><div class="bub"><span class="dots"><i></i><i></i><i></i></span></div></div></div></div>`
    : '';

  const head = c.group ? `<b>${esc(c.title)}</b><small>${c.count}</small>` : `<b>${kw(esc(c.title))}</b>`;
  const rail = (d, on) => `<span class="${on ? 'on' : ''}"><svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">${d}</svg></span>`;

  return `<div class="msgr">
    <nav class="lt-rail">
      ${rail('<circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>', false)}
      ${rail('<path d="M12 4C7 4 3 7.2 3 11.2c0 2.5 1.6 4.7 4 6L6.3 21l4.1-2.4c.5.1 1 .1 1.6.1 5 0 9-3.2 9-7.2S17 4 12 4z" fill="currentColor"/>', true)}
      ${rail('<circle cx="6" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="18" cy="12" r="1.6" fill="currentColor"/>', false)}
      <span class="me">${avatar(PEOPLE.seojin)}</span>
    </nav>
    <aside class="chat-list">
      <div class="chat-list-head"><b>채팅</b><span><svg width="18" height="18" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m15.5 15.5 5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></span></div>
      ${list}
    </aside>
    <section class="chat-pane">
      <header class="chat-head">${head}</header>
      <div class="chat-log">${rows}${typing}</div>
      <footer class="chat-input"><span>메시지 입력 (재생 중인 기록이라 보낼 수 없습니다)</span><button disabled>전송</button></footer>
    </section>
  </div>`;
}

// '23:41' → '오후 11:41'
function ampm(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return `${h < 12 ? '오전' : '오후'} ${h % 12 === 0 ? 12 : h % 12}:${pad2(m)}`;
}

function lastTime(m) {
  return m.day === TODAY ? ampm(m.time) : m.day.replace(/ \S+요일$/, '');
}

/* 메일 */
function renderMail(w) {
  const sel = vm.mails.find(m => m.id === w.data.sel);
  if (sel) vm.mailRead.add(sel.id);
  const unread = vm.mails.filter(m => !vm.mailRead.has(m.id)).length;

  const list = vm.mails.map(m => `
    <button class="mail-item ${m.id === w.data.sel ? 'on' : ''} ${vm.mailRead.has(m.id) ? '' : 'unread'} ${m.fresh ? 'fresh' : ''}" data-a="mail" data-id="${m.id}">
      <span class="mi-top"><b>${esc(m.from)}</b><time>${m.date}</time></span>
      <span class="mi-sub">${esc(m.subject)}</span>
    </button>`).join('');
  vm.mails.forEach(m => { m.fresh = false; });

  const pane = sel
    ? `<article class="mail-read">
        <div class="mail-top"><h2>${kw(esc(sel.subject))}</h2><button class="pin-wide ${sel.clue && save.clues[sel.clue] ? 'on' : ''}" data-a="pin" data-kind="mail" data-id="${sel.id}">${SVG_PIN} 노트에 꽂기</button></div>
        <div class="mail-meta">
          <span class="av" style="--c:#5a6b85">${esc(sel.from.slice(0, 1))}</span>
          <div><b>${kw(esc(sel.from))}</b> <span>&lt;${esc(sel.addr)}&gt;</span><small>받는 사람: ${esc(sel.to)} · ${kw(esc(sel.full))}</small></div>
        </div>
        <div class="mail-body">${kwHtml(sel.body)}</div>
      </article>`
    : `<div class="empty">${icon('mail', 56)}<p>읽을 항목을 선택하세요</p></div>`;

  return `<div class="mailapp">
    <aside class="mail-side">
      <div class="mail-new">새 메일</div>
      <div class="mail-acc">han.seojin@payroad.kr</div>
      <div class="mail-folder on">받은 편지함 <b>${unread || ''}</b></div>
      <div class="mail-folder">임시 보관함</div>
      <div class="mail-folder">보낸 편지함</div>
      <div class="mail-folder">보관</div>
      <div class="mail-folder">정크 메일</div>
      <div class="mail-folder">지운 편지함</div>
    </aside>
    <div class="mail-list"><div class="mail-list-head">받은 편지함</div>${list}</div>
    <div class="mail-pane">${pane}</div>
  </div>`;
}

/* 파일 탐색기 */
const PHOTO_SRC = {
  house: 'photo/2009_제천_할머니집.jpg',
  attic: 'photo/2009_비밀기지.jpg',
  sea: 'photo/2021_강릉_워크숍.jpg',
};

function renderExplorer(w) {
  if (w.data.dir === 'usb' && !vm.usb) w.data.dir = 'docs';
  const dir = w.data.dir;
  const NAV = [['desktop', '바탕 화면', 'navDesk'], ['downloads', '다운로드', 'navDown'], ['docs', '문서', 'navDocs'], ['photos', '사진', 'navPics']];
  const item = (id, label, ic, extra = '') =>
    `<button class="side-item ${dir === id ? 'on' : ''}" data-a="dir" data-dir="${id}">${icon(ic, 16)}<span>${label}</span>${extra}</button>`;
  const side = NAV.map(([id, label, ic]) => item(id, label, ic)).join('') +
    '<div class="side-sep"></div>' + item('trash', '휴지통', 'trash') +
    '<div class="side-sep"></div>' +
    `<div class="side-item" style="pointer-events:none">${icon('pc', 16)}<span>내 PC</span></div>` +
    `<button class="side-item ${dir === 'usb' ? 'on' : ''} ${vm.usb ? '' : 'off'}" data-a="dir" data-dir="usb" ${vm.usb ? '' : 'disabled'}>${icon('usb', 16)}<span>USB 드라이브 (E:)</span></button>`;

  const label = dir === 'usb' ? 'USB 드라이브 (E:)' : dir === 'trash' ? '휴지통' : NAV.find(f => f[0] === dir)[1];
  let grid;
  let count = 0;
  if (dir === 'usb') {
    grid = `<div class="exp-empty">${icon('usb', 48)}<p>이 드라이브의 내용은 COLD_BOOT 기록에 포함되지 않았습니다.</p><span>SanDisk Ultra · 32GB</span></div>`;
  } else {
    const files = vm.files[dir];
    count = files.length;
    grid = files.length
      ? files.map((f, i) => {
        const pic = f.kind === 'photo'
          ? `<span class="thumb"><img src="${PHOTO_SRC[f.ref]}" alt="" onerror="this.parentNode.classList.add('noimg')">${icon('img', 48)}</span>`
          : `<span class="thumb plain">${icon(f.icon, 48)}</span>`;
        return `<button class="file ${w.data.selIdx === i ? 'sel' : ''} ${f.fresh ? 'fresh' : ''}" data-a="file" data-i="${i}" title="${esc(f.name)}">${pic}<span>${esc(f.name)}</span></button>`;
      }).join('')
      : '<div class="exp-empty"><p>이 폴더는 비어 있습니다.</p></div>';
    files.forEach(f => { f.fresh = false; });
  }

  const selFile = dir !== 'usb' && w.data.selIdx != null ? vm.files[dir][w.data.selIdx] : null;
  const cmd = (d, t = '') => `<span><svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>${t}</span>`;
  return `<div class="exp">
    <div class="exp-cmd">
      ${cmd('<path d="M12 5v14M5 12h14" stroke="#60cdff" stroke-width="2" stroke-linecap="round"/>', '새로 만들기')}
      <span class="sep"></span>
      ${cmd('<circle cx="6" cy="17" r="3" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="18" cy="17" r="3" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 15 17 4M16 15 7 4" stroke="currentColor" stroke-width="1.6"/>')}
      ${cmd('<rect x="8" y="8" width="11" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M5 16V5a2 2 0 0 1 2-2h8" fill="none" stroke="currentColor" stroke-width="1.6"/>')}
      ${cmd('<rect x="6" y="5" width="12" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="9" y="3" width="6" height="4" rx="1" fill="none" stroke="currentColor" stroke-width="1.6"/>')}
      ${cmd('<path d="M5 19h4L19 9l-4-4L5 15z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>')}
      ${cmd('<path d="M6 7h12l-1 13H7zM4 7h16M10 7V4h4v3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>')}
      <span class="sep"></span>
      ${cmd('<path d="M7 4v16M4 17l3 3 3-3M17 20V4M14 7l3-3 3 3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>', '정렬')}
      ${cmd('<rect x="4" y="4" width="7" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="13" y="4" width="7" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="4" y="13" width="7" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="13" y="13" width="7" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="1.6"/>', '보기')}
    </div>
    <div class="exp-bar">
      <span class="nav">
        <svg viewBox="0 0 24 24"><path d="M19 12H5M11 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <svg viewBox="0 0 24 24"><path d="M12 19V5M6 11l6-6 6 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </span>
      <span class="crumb">${icon(dir === 'usb' ? 'usb' : dir === 'trash' ? 'trash' : 'folder', 16)}<i>›</i>${dir === 'usb' || dir === 'trash' ? '' : '내 PC<i>›</i>'}<b>${label}</b></span>
      <span class="search"><svg width="14" height="14" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m15.5 15.5 5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>${label} 검색</span>
    </div>
    <div class="exp-main">
      <aside class="exp-side">${side}</aside>
      <section class="exp-content">
        <div class="exp-grid">${grid}</div>
        <footer class="exp-status"><span>항목 ${count}개</span><span class="exp-sel">${selFile ? `1개 항목 선택함  ${selFile.size}` : ''}</span></footer>
      </section>
    </div>
  </div>`;
}

/* 이벤트 뷰어 */
const EV_ICON = {
  info: '<svg width="14" height="14" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="#1e6fd9"/><rect x="7.2" y="7" width="1.6" height="5" fill="#fff"/><circle cx="8" cy="4.8" r="1" fill="#fff"/></svg>',
  warn: '<svg width="14" height="14" viewBox="0 0 16 16"><path d="M8 1.5 15 14H1z" fill="#f2b400" stroke="#b58700" stroke-width=".6"/><rect x="7.3" y="5.5" width="1.4" height="5" fill="#222"/><circle cx="8" cy="12" r=".8" fill="#222"/></svg>',
  crit: '<svg width="14" height="14" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="#d13438"/><path d="M5.2 5.2l5.6 5.6M10.8 5.2l-5.6 5.6" stroke="#fff" stroke-width="1.6"/></svg>',
};
const LV = { info: '정보', warn: '경고', crit: '위험' };
const EV_ID = { 'Kernel-Power': 107, 'Netlogon': 5783, 'Defender': 2001, 'COLD_BOOT': 1, 'USB': 2003, 'SQL Client': 3402, '파일 시스템': 4663, '보안': 4738, 'MDM': 404 };

function renderEvents(w) {
  const sel = w.data.sel ?? vm.logs.length - 1;
  const rows = vm.logs.map((l, i) => `
    <tr class="${l.fresh ? 'fresh' : ''} ${i === sel ? 'on' : ''}" data-a="ev" data-i="${i}">
      <td><span class="lv">${EV_ICON[l.lv]}${LV[l.lv]}</span></td>
      <td>2026-11-20 ${kwTime(l.time.slice(0, 5), ampm(l.time.slice(0, 5)) + ':' + l.time.slice(6))}</td>
      <td>${esc(l.src)}</td>
      <td>${EV_ID[l.src] || 0}</td>
      <td>없음</td>
    </tr>`).join('');
  vm.logs.forEach(l => { l.fresh = false; });
  const s = vm.logs[sel] || vm.logs[vm.logs.length - 1];
  const tree = (cls, d, t) => `<div class="${cls}">${d}${t}</div>`;
  const fold = '<svg width="14" height="14" viewBox="0 0 48 48">' + ICONS.folder + '</svg>';
  const logi = '<svg width="14" height="14" viewBox="0 0 48 48">' + ICONS.log + '</svg>';
  return `<div class="mmc">
    <nav class="mmc-menu"><span>파일(F)</span><span>동작(A)</span><span>보기(V)</span><span>도움말(H)</span></nav>
    <div class="mmc-tool">
      <i><svg width="14" height="14" viewBox="0 0 24 24"><path d="M15 5 8 12l7 7" fill="none" stroke="currentColor" stroke-width="2.4"/></svg></i>
      <i><svg width="14" height="14" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.4"/></svg></i>
      <i><svg width="14" height="14" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"/></svg></i>
      <i><svg width="14" height="14" viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.4-5.7M20 4v5h-5" fill="none" stroke="currentColor" stroke-width="2.2"/></svg></i>
    </div>
    <div class="mmc-body">
      <aside class="mmc-tree">
        ${tree('', logi, '이벤트 뷰어 (로컬)')}
        ${tree('l1', fold, '사용자 지정 보기')}
        ${tree('l1', fold, 'Windows 로그')}
        ${tree('l2', logi, '응용 프로그램')}
        ${tree('l2', logi, '보안')}
        ${tree('l2', logi, 'Setup')}
        ${tree('l2 on', logi, '시스템')}
        ${tree('l2', logi, 'Forwarded Events')}
        ${tree('l1', fold, '응용 프로그램 및 서비스 로그')}
        ${tree('l1', fold, '구독')}
      </aside>
      <section class="mmc-center">
        <div class="mmc-caption">시스템 <span>이벤트 수: ${vm.logs.length}</span></div>
        <div class="ev-scroll"><table>
          <colgroup><col style="width:84px"><col style="width:190px"><col style="width:110px"><col style="width:80px"><col></colgroup>
          <thead><tr><th>수준</th><th>날짜 및 시간</th><th>원본</th><th>이벤트 ID</th><th>작업 범주</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>
        <div class="mmc-detail">
          <div class="mmc-dhead"><b>이벤트 ${EV_ID[s.src] || 0}, ${esc(s.src)}</b><button class="pin-wide light ${s.clue && save.clues[s.clue] ? 'on' : ''}" data-a="pin" data-kind="log" data-i="${vm.logs.indexOf(s)}">${SVG_PIN} 노트에 꽂기</button></div>
          <p>${kw(esc(s.text))}</p>
          <dl><dt>로그 이름:</dt><dd>시스템</dd><dt>원본:</dt><dd>${esc(s.src)}</dd><dt>기록된 날짜:</dt><dd>2026-11-20 ${ampm(s.time.slice(0, 5))}:${s.time.slice(6)}</dd><dt>컴퓨터:</dt><dd>DEV-HANSJ-03</dd></dl>
        </div>
      </section>
    </div>
  </div>`;
}

/* 메모장 */
function notepad(text) {
  const lines = text.split('\n').length;
  return `<div class="np">
    <nav class="np-menu"><span>파일</span><span>편집</span><span>보기</span></nav>
    <pre class="np-text">${kw(esc(text))}</pre>
    <footer class="np-status"><span>줄 ${lines}, 열 1</span><span>100%</span><span>Windows (CRLF)</span><span>UTF-8</span></footer>
  </div>`;
}

function renderDoc(w) {
  return notepad(DOCS[w.data.doc].text);
}

/* 사진 */
function renderPhoto(w) {
  const p = PHOTOS[w.data.photo];
  const b = d => `<i><svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">${d}</svg></i>`;
  return `<div class="pv">
    <div class="pv-bar">
      <b>${esc(w.data.name)}</b>
      ${b('<circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M11 8v6M8 11h6M16 16l4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>')}
      ${b('<circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 11h6M16 16l4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>')}
      ${b('<path d="M20 12a8 8 0 1 1-2.4-5.7M20 4v5h-5" fill="none" stroke="currentColor" stroke-width="1.6"/>')}
      ${b('<path d="M6 7h12l-1 13H7zM4 7h16M10 7V4h4v3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>')}
      ${b('<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 11v5M12 8v.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>')}
    </div>
    <div class="pv-stage"><div class="pv-frame">${p.svg}</div></div>
    <footer class="pv-info">
      <div><b>${esc(w.data.name)}</b><span>${esc(p.date)}</span></div>
      <p><small>설명</small>${kw(esc(p.desc))}</p>
    </footer>
  </div>`;
}

/* 압축 파일 */
function renderZip(w) {
  return `<form class="sz ${w.data.err ? 'shake' : ''}" data-form="zip">
    <div class="sz-row">${icon('lock', 32)}<p>다음 압축 파일의 암호를 입력하십시오.<br><b>ledger_backup.zip</b></p></div>
    <p class="hint">압축 파일 주석: 제천 할머니 집 와이파이</p>
    <label>암호(P):
      <input name="pw" type="password" autocomplete="off" spellcheck="false" autocapitalize="off" aria-label="압축 파일 암호">
    </label>
    <label class="chk"><input type="checkbox" data-pwshow> 암호 표시(S)</label>
    ${w.data.err ? '<p class="sz-err">암호가 잘못되었습니다. 다시 입력하십시오.</p>' : ''}
    <div class="sz-btns"><button type="submit" class="w-btn def">확인</button><button type="button" class="w-btn" data-a="win-close">취소</button></div>
  </form>`;
}

function renderZipDir() {
  return `<div class="zip-open">
    <div class="zip-head">${icon('zip', 28)}<div>ledger_backup.zip<small>압축 해제됨 · 항목 2개</small></div></div>
    <div class="zip-cols"><span>이름</span><span>유형</span><span>크기</span></div>
    <button class="zip-row" data-a="zip-csv"><span>${icon('csv', 20)}송금내역_요약.csv</span><small>CSV 파일</small><small>18KB</small></button>
    <button class="zip-row" data-a="zip-letter"><span>${icon('txt', 20)}도윤에게.txt</span><small>텍스트 문서</small><small>1KB</small></button>
  </div>`;
}

/* 송금 내역 */
function renderCsv() {
  const rows = LEDGER.map(([d, amt, memo]) => `${d},${amt},에버그린 홀딩스,윤서영,${memo},moon.tk`);
  const total = LEDGER.reduce((s, r) => s + r[1], 0);
  return notepad([
    '일자,금액,수취인,법인대표,적요,승인자',
    ...rows,
    `합계,${total},,,,`,
    '',
    '# 출처: ledger_prod.withdrawals (고객 예치금 계정)',
    '# 추출: 2026-11-20 22:29 han.seojin',
  ].join('\n'));
}

function renderDialog(w) {
  return `<div class="dlg">
    <div class="dlg-body">${icon('info', 32)}<p>${esc(w.data.text)}</p></div>
    <div class="dlg-btns"><button data-a="win-close">확인</button></div>
  </div>`;
}

/* 파일 열기 */
function openFile(f) {
  if (!f) return;
  if (f.kind === 'doc') openApp('doc', { id: 'doc:' + f.ref, title: f.name + ' - 메모장', data: { doc: f.ref, clue: DOCS[f.ref].clue } });
  else if (f.kind === 'photo') openApp('photo', { id: 'photo:' + f.ref, title: f.name + ' - 사진', data: { photo: f.ref, name: f.name, clue: PHOTOS[f.ref].clue } });
  else if (f.kind === 'zip') {
    if (vm.unlocked) openApp('zipdir', { data: { clue: 'zip' } });
    else openApp('zip', { data: { clue: 'zip' } });
  } else {
    openApp('dialog', { id: 'dlg:' + f.name, title: f.name, data: { text: '이 파일을 열 수 있는 앱이 없습니다. 재생 기록에는 PDF 뷰어가 포함되어 있지 않습니다.' } });
  }
}

/* 바탕화면 아이콘 */
const DESKTOP_APPS = [
  { key: 'trash', label: '휴지통', icon: 'trash' },
  { key: 'messenger', label: '링크톡', icon: 'chat' },
  { key: 'mail', label: '메일', icon: 'mail' },
  { key: 'explorer', label: '파일 탐색기', icon: 'folder' },
  { key: 'events', label: '이벤트 뷰어', icon: 'log' },
];

let deskSel = null;

function launch(key) {
  if (key === 'photos') openApp('explorer', { data: { dir: 'photos', selIdx: null } });
  else if (key === 'trash') openApp('explorer', { data: { dir: 'trash', selIdx: null } });
  else if (key === 'explorer') openApp('explorer', { data: { selIdx: null } });
  else openApp(key);
}

function unreadMsgs() { return Object.values(vm.unread).reduce((a, b) => a + b, 0); }
function unreadMails() { return vm.mails.filter(m => !vm.mailRead.has(m.id)).length; }

function renderIcons() {
  const badges = { messenger: unreadMsgs(), mail: unreadMails() };
  const apps = DESKTOP_APPS.map(a => `
    <button class="dicon ${deskSel === a.key ? 'sel' : ''}" data-desk="${a.key}" role="listitem">
      ${icon(a.icon, 44)}<span>${a.label}</span>${badges[a.key] ? `<b class="badge">${badges[a.key]}</b>` : ''}
    </button>`).join('');
  const files = vm.files.desktop.map((f, i) => `
    <button class="dicon ${deskSel === 'f' + i ? 'sel' : ''}" data-desk="f${i}" role="listitem">${icon(f.icon, 44)}<span>${esc(f.name)}</span></button>`).join('');
  $('#icons').innerHTML = apps + files;
}

function openDesk(key) {
  if (key.startsWith('f')) openFile(vm.files.desktop[+key.slice(1)]);
  else launch(key);
}

/* 작업 표시줄 */
function renderTaskbar() {
  const pinned = ['explorer', 'mail', 'messenger'];
  const badges = { messenger: unreadMsgs(), mail: unreadMails() };
  const open = [...wins.values()];
  let html = pinned.map(app => {
    const ws = open.filter(w => w.app === app);
    const focus = ws.some(w => w.id === focusedId);
    return `<button class="tb-app ${ws.length ? 'open' : ''} ${focus ? 'focus' : ''}" data-tb="${app}" title="${APPS[app].title}">${icon(APPS[app].icon, 24)}${badges[app] ? `<b class="badge">${badges[app]}</b>` : ''}</button>`;
  }).join('');
  html += open.filter(w => !pinned.includes(w.app)).map(w =>
    `<button class="tb-app open ${w.id === focusedId ? 'focus' : ''}" data-tbw="${esc(w.id)}" title="${esc(w.title)}">${icon(w.icon, 24)}</button>`).join('');
  $('#tb-apps').innerHTML = html;
}

function refreshBadges() {
  renderIcons();
  renderTaskbar();
}

/* 시작 메뉴 */
let powerOpen = false;

function openStart() {
  const el = $('#startmenu');
  const recent = [
    ['docs', 0, '업무일지_11월.txt', '오늘 오후 9:40'],
    ['desktop', 0, 'COLD_BOOT_메모.txt', '11월 2일'],
    ['photos', 0, '2009_제천_할머니집.jpg', '11월 14일'],
    ['downloads', 0, '바로콜_영수증_1103.pdf', '11월 3일'],
  ];
  el.innerHTML = `
    <div class="sm-inner">
      <div class="sm-search"><svg width="16" height="16" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m15.5 15.5 5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>앱, 설정, 문서 검색</div>
      <div class="sm-sec">고정됨 <span>모든 앱 ›</span></div>
      <div class="sm-grid">
        ${DESKTOP_APPS.map(a => `<button class="sm-app" data-a="sm-app" data-key="${a.key}">${icon(a.icon, 32)}<span>${a.label}</span></button>`).join('')}
        <button class="sm-app" data-a="sm-app" data-key="photos">${icon('navPics', 32)}<span>사진</span></button>
      </div>
      <div class="sm-sec">추천 <span>자세히 ›</span></div>
      <div class="sm-rec">
        ${recent.map(([dir, i, name, when]) => {
          const f = vm.files[dir][i];
          return `<button data-a="sm-file" data-dir="${dir}" data-i="${i}">${icon(f.icon, 28)}<span>${esc(name)}<small>${when}</small></span></button>`;
        }).join('')}
      </div>
    </div>
    <div class="sm-foot">
      <div class="sm-user"><span class="av" style="--c:#5a72a8">서</span>한서진</div>
      <button class="sm-power ${powerOpen ? 'on' : ''}" data-a="power" aria-label="전원">
        <svg width="16" height="16" viewBox="0 0 24 24"><path d="M12 3v8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M6.3 6.3a8 8 0 1 0 11.4 0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
      </button>
      ${powerOpen ? `<div class="sm-pmenu">
        <button disabled>절전</button>
        <button disabled>시스템 종료</button>
        <button data-a="rewind">다시 시작</button>
      </div>` : ''}
    </div>`;
  el.hidden = false;
  $('#btn-start').classList.add('on');
}

function closeStart() {
  $('#startmenu').hidden = true;
  $('#btn-start').classList.remove('on');
  powerOpen = false;
}

/* 알림 */
/* Windows 알림 (가상 PC 쪽) */
function toast({ ic, app, title, text, onClick }) {
  const box = $('#toasts');
  const el = document.createElement('button');
  el.className = 'toast';
  el.innerHTML = `<span class="t-head">${icon(ic, 16)}<span>${esc(app)}</span><em>···</em></span><span class="t-body"><b>${esc(title)}</b>${text ? `<span>${esc(text)}</span>` : ''}</span>`;
  const dismiss = () => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 220);
  };
  el.addEventListener('click', () => { if (onClick) onClick(); dismiss(); });
  box.appendChild(el);
  while (box.children.length > 3) box.firstElementChild.remove();
  setTimeout(dismiss, 5600);
}

/* Mac 알림 (호스트 쪽: 수사 노트) */
function htoast({ ic = 'notes', app = '수사 노트', title, text, onClick }) {
  const box = $('#htoasts');
  const el = document.createElement('div');
  el.className = 'htoast';
  el.innerHTML = `${icon(ic, 30)}<div><small><span>${esc(app)}</span><span>지금</span></small><b>${esc(title)}</b>${text ? `<span>${esc(text)}</span>` : ''}</div>`;
  const dismiss = () => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 250);
  };
  el.addEventListener('click', () => { if (onClick) onClick(); dismiss(); });
  box.appendChild(el);
  while (box.children.length > 3) box.firstElementChild.remove();
  setTimeout(dismiss, 3800);
}

/* ---------------------------------------------------------
   8. 관찰 → 단서 기록
   창이 열려 있고(최소화 안 됨) 그 순간 화면에 있는 것만 기록된다.
   --------------------------------------------------------- */

// 예전에는 창에 보이기만 해도 자동으로 기록했지만, 이제는 플레이어가 직접 📌 핀을 꽂아야 한다
function observe() {}

/* 📌 핀 꽂기: 메시지, 메일, 로그, 문서 창 */
function pinItem(t) {
  const kind = t.dataset.kind;
  let clue = null;
  if (kind === 'msg') {
    const m = vm.msgs[t.dataset.chat][+t.dataset.i];
    clue = m && !m.deleted ? m.clue : null;
  } else if (kind === 'mail') {
    clue = (vm.mails.find(x => x.id === t.dataset.id) || {}).clue;
  } else if (kind === 'log') {
    clue = (vm.logs[+t.dataset.i] || {}).clue;
  } else {
    const w = winOf(t);
    clue = w && w.data.clue;
  }
  if (!clue) {
    save.misses = (save.misses || 0) + 1;
    persist();
    Sound.sfx('page');
    htoast({ title: '눈에 띄는 단서는 아닌 것 같다', text: '핀을 도로 뽑았다' });
    return;
  }
  if (save.clues[clue]) {
    htoast({ title: '이미 꽂아 둔 단서', text: CLUES[clue].title, onClick: openNotes });
    return;
  }
  gain(clue);
  t.classList.add('on');
}

function gain(id) {
  if (save.clues[id] || !CLUES[id]) return;
  save.clues[id] = save.loop;
  newClues.add(id);
  persist();
  htoast({ title: CLUES[id].title, text: '수사 노트에 꽂았다', onClick: openNotes });
  Sound.sfx('clue');
  updateNotesCount();
  const btn = $('#btn-notes');
  btn.classList.remove('ping');
  void btn.offsetWidth;
  btn.classList.add('ping');
  renderTimelineMarks();
  if (notesOpen) renderNotes();
}

// 지금까지 모은 단어 (처음부터 주는 단어 + 단서 + 추론)
// 지금까지 모은 단어 (처음부터 주는 단어 + 직접 누른 단어 + 추론으로 얻은 단어)
function knownWords() {
  const set = new Set(STARTER_WORDS);
  Object.keys(save.words || {}).forEach(x => set.add(x));
  DEDUCTIONS.forEach(d => { if (save.deds[d.id]) d.w.forEach(x => set.add(x)); });
  return set;
}

/* 글 속 단어: 마우스를 올리면 밑줄, 누르면 보고서 단어로 모임 */
const SURFACES = Object.keys(WORDS)
  .filter(w => WORDS[w] !== 'relation')
  .map(w => [w, w])
  .concat([['창고 위 다락', '제천 할머니 집 다락'], ['판교 (자택)', '판교 자택'], ['준혁 팀장님', '강준혁']])
  .map(([s, w]) => [esc(s), w])
  .sort((a, b) => b[0].length - a[0].length);
const SURF_MAP = Object.fromEntries(SURFACES);
const KW_RE = new RegExp(SURFACES.map(([s]) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');

// 이미 이스케이프된 글에 단어 표시 달기
function kw(text) {
  return text.replace(KW_RE, m => {
    const w = SURF_MAP[m];
    return `<span class="kw ${save.words && save.words[w] ? 'got' : ''}" data-w="${esc(w)}">${m}</span>`;
  });
}

// 메일 본문처럼 태그가 섞인 글: 태그 밖의 글자에만 표시
function kwHtml(html) {
  return html.split(/(<[^>]+>)/).map(part => (part.startsWith('<') ? part : kw(part))).join('');
}

// 시각 자체가 단어인 경우 (메시지 보낸 시각 등)
function kwTime(hhmm, label) {
  return WORDS[hhmm] === 'time'
    ? `<span class="kw ${save.words && save.words[hhmm] ? 'got' : ''}" data-w="${hhmm}">${label}</span>`
    : label;
}

function collectWord(w, e) {
  if (!WORDS[w]) return;
  const fresh = !save.words[w];
  if (fresh) {
    save.words[w] = save.loop;
    persist();
    Sound.sfx('word');
    $$(`.kw[data-w="${CSS.escape(w)}"]`).forEach(x => x.classList.add('got'));
    if (notesOpen) renderNotes();
  }
  // 누른 자리에 "+ 단어" 표시
  const r = stage.getBoundingClientRect();
  const pop = document.createElement('div');
  pop.className = 'wpop' + (fresh ? '' : ' old');
  pop.textContent = fresh ? `+ ${w}` : `${w} (이미 적음)`;
  pop.style.left = ((e.clientX - r.left) / scale) + 'px';
  pop.style.top = ((e.clientY - r.top) / scale - 10) + 'px';
  stage.appendChild(pop);
  setTimeout(() => pop.remove(), 1100);
}

function updateNotesCount() {
  $('#notes-count').textContent = Object.keys(save.clues).length + Object.keys(save.deds).length;
}

/* ---------------------------------------------------------
   9. 시간 흐름과 사건
   --------------------------------------------------------- */

function fire(e) {
  switch (e.type) {
    case 'msg': {
      vm.msgs[e.chat].push({ day: TODAY, time: e.t, who: e.who, text: e.text, clue: e.clue, key: e.key, unread: e.unread, fresh: true });
      if (vm.typing[e.chat] && vm.typing[e.chat].who === e.who) delete vm.typing[e.chat];
      if (e.who !== 'seojin') Sound.sfx('msg');
      if (e.who !== 'seojin' && !chatVisible(e.chat)) {
        vm.unread[e.chat] += 1;
        const c = CHATS.find(x => x.id === e.chat);
        toast({ ic: 'chat', app: '링크톡', title: c.title, text: '새 메시지가 있습니다', onClick: () => openApp('messenger', { data: { chat: e.chat } }) });
      }
      rerender('messenger');
      break;
    }
    case 'typing':
      vm.typing[e.chat] = { who: e.who, until: tm(e.until) };
      if (chatVisible(e.chat)) Sound.sfx('key');
      rerender('messenger');
      break;
    case 'delete': {
      const m = vm.msgs[e.chat].find(x => x.key === e.key);
      if (m) m.deleted = true;
      if (chatVisible(e.chat)) Sound.sfx('remove');
      rerender('messenger');
      break;
    }
    case 'mail':
      vm.mails.unshift({ ...e.mail, fresh: true });
      Sound.sfx('mail');
      toast({ ic: 'mail', app: '메일', title: e.mail.from, text: e.mail.subject, onClick: () => openApp('mail', { data: { sel: e.mail.id } }) });
      rerender('mail');
      break;
    case 'log':
      vm.logs.push({ ...e.log, fresh: true });
      rerender('events');
      break;
    case 'file':
      vm.files[e.dir].push({ ...e.file, fresh: true });
      rerender('explorer');
      break;
    case 'usb':
      vm.usb = e.on;
      rerender('explorer');
      break;
    case 'wipe':
      startWipe();
      break;
  }
  refreshBadges();
}

function winClock(t) {
  const total = 22 * 60 + Math.floor(t);
  const h = Math.floor(total / 60) % 24;
  return `${h < 12 ? '오전' : '오후'} ${h % 12 === 0 ? 12 : h % 12}:${pad2(total % 60)}`;
}

function updateClock() {
  $('#clock-time').textContent = winClock(vm.t);
  $('#tl-fill').style.width = (vm.t / LOOP_LEN * 100) + '%';
  stage.classList.toggle('tense', vm.t >= tm('23:55'));
  stage.classList.toggle('late', vm.t >= tm('23:30'));
}

function renderTimelineMarks() {
  $('#tl-marks').innerHTML = Object.keys(save.clues)
    .filter(id => CLUES[id].t)
    .map(id => `<i style="left:${tm(CLUES[id].t) / LOOP_LEN * 100}%" title="${CLUES[id].t} ${esc(CLUES[id].title)}"></i>`)
    .join('');
}

function glitchPulse() {
  stage.style.setProperty('--gy', Math.floor(Math.random() * 640) + 'px');
  stage.classList.add('glitch');
  setTimeout(() => stage.classList.remove('glitch'), 160);
}

function frame(now) {
  const dt = Math.min(0.25, (now - lastFrame) / 1000);
  lastFrame = now;

  if (running && !paused) {
    vm.t = Math.min(LOOP_LEN, vm.t + dt * speed / SEC_PER_MIN);
    while (vm.ev < EVENTS.length && EVENTS[vm.ev].m <= vm.t) fire(EVENTS[vm.ev++]);
    updateClock();
    updateWipe();

    Sound.setTension(vm.t);
    const minute = Math.floor(vm.t);
    if (minute !== lastMinute) {
      lastMinute = minute;
      observe();
      if (vm.t >= tm('23:52')) Sound.sfx('beat');
    }
    if (vm.t >= tm('23:52') && !REDUCED && Math.random() < dt * (vm.t >= WIPE_AT ? 2.2 : 0.5)) glitchPulse();
    if (vm.t >= LOOP_LEN) endLoop('end');
  }

  drawRain(dt);
  requestAnimationFrame(frame);
}


/* ---------------------------------------------------------
   10. 원격 초기화, 회차 끝, 부팅
   --------------------------------------------------------- */

const WIPE_PATHS = [
  'C:\\Users\\seojin\\Documents\\업무일지_11월.txt',
  'C:\\Users\\seojin\\Downloads\\ledger_backup.zip',
  'C:\\Users\\seojin\\Pictures\\2009_제천_할머니집.jpg',
  'C:\\Users\\seojin\\Pictures\\2009_비밀기지.jpg',
  'C:\\Users\\seojin\\Pictures\\2021_강릉_워크숍.jpg',
  'C:\\Users\\seojin\\AppData\\Local\\LinkTalk\\chat.db',
  'C:\\Users\\seojin\\AppData\\Local\\LinkTalk\\media\\',
  'C:\\Users\\seojin\\Desktop\\COLD_BOOT_메모.txt',
  'C:\\Users\\seojin\\Documents\\이력서_한서진_2024.pdf',
  'C:\\Users\\seojin\\AppData\\Roaming\\Mail\\inbox.mbx',
  'C:\\ProgramData\\COLD_BOOT\\snapshot.idx',
  'C:\\Users\\seojin\\$Recycle.Bin\\하린_생일선물.txt',
  'C:\\Users\\seojin\\source\\payroad-settlement\\',
  'C:\\Users\\seojin\\.ssh\\id_ed25519',
];

function startWipe() {
  vm.wiping = true;
  vm.wipeN = 0;
  closeStart();
  $('#toasts').innerHTML = '';
  const el = $('#wipe');
  el.innerHTML = `<div class="reset">
    <div class="win-spin"><i></i><i></i><i></i><i></i><i></i></div>
    <h2>이 PC를 초기화하는 중 <span id="wipe-pct">0</span>%</h2>
    <p>원격 관리자가 요청한 작업입니다. PC를 끄지 마세요.</p>
  </div>
  <small id="wipe-files"></small>`;
  el.hidden = false;
  Sound.sfx('alarm');
}

function updateWipe() {
  if (!vm.wiping) return;
  const p = clamp((vm.t - WIPE_AT) / (LOOP_LEN - WIPE_AT), 0, 1);
  const pct = $('#wipe-pct');
  if (!pct) return;
  pct.textContent = Math.floor(p * 100);
  let changed = false;
  while (vm.wipeN < Math.floor(p * 64)) {
    vm.wipeN += 1;
    changed = true;
    Sound.sfx('hdd');
  }
  if (changed) {
    const lines = [];
    for (let i = Math.max(0, vm.wipeN - 4); i < vm.wipeN; i += 1) lines.push('del  ' + WIPE_PATHS[i % WIPE_PATHS.length]);
    $('#wipe-files').textContent = lines.join('\n');
  }
}

function endLoop(reason) {
  if (transitioning) return;
  transitioning = true;
  running = false;
  closeStart();
  if (notesOpen) closeNotes();

  const el = $('#lost');
  el.innerHTML = `<div class="lost-inner">
    <b data-text="SIGNAL LOST">SIGNAL LOST</b>
    <span>${reason === 'manual' ? '사용자 요청 · 재생을 되감습니다' : '기록 종료 · 23:58:12 이후 데이터 없음'}</span>
    <span class="lost-sub">스냅샷 2026-11-20 22:00:00 으로 되돌리는 중…</span>
  </div>`;
  el.hidden = false;
  stage.classList.add('glitch-hard');
  Sound.sfx('lost');
  Sound.setTension(0);

  setTimeout(() => {
    save.loop += 1;
    persist();
    stage.classList.remove('glitch-hard');
    el.hidden = true;
    boot();
  }, 2300);
}

function boot() {
  transitioning = false;
  running = false;
  paused = false;
  closeAllWindows();
  closeStart();
  vm = freshVM();
  lastMinute = -1;
  deskSel = null;
  $('#wipe').hidden = true;
  $('#wipe').innerHTML = '';
  $('#toasts').innerHTML = '';
  $('#veil').hidden = true;
  $('#twist').hidden = true;
  $('#lock').hidden = true;
  $('#htoasts').innerHTML = '';
  stage.classList.remove('tense', 'late', 'glitch');
  $('#loop-tag').textContent = 'LOOP ' + pad2(save.loop);
  updateNotesCount();
  refreshBadges();
  updateClock();
  renderTimelineMarks();

  const el = $('#boot');
  el.hidden = false;
  if (save.loop === 1 && !save.intro) showIntro();
  else showBootLog();
}

const MAC_MENU = (app) => `<div class="mac-menubar"><b>${app}</b><span>파일</span><span>편집</span><span>보기</span><span>윈도우</span><span class="r">11월 25일 (화) 오전 4:12</span></div>`;

function showIntro() {
  const el = $('#boot');
  el.className = 'intro-mode';
  el.innerHTML = `${MAC_MENU('메일')}
    <div class="mac-win intro">
      <div class="mac-bar"><span class="mac-dots"><i></i><i></i><i></i></span><span>받은 편지함 — doyun.han@mail.kr</span></div>
      <div class="intro-head">
        <span class="av" style="--c:#5a72a8">서</span>
        <div><b>한서진</b> <span>&lt;seojin.han.dev@mail.kr&gt;</span><small>받는 사람: 한도윤 · 2026년 11월 23일 (월) 오후 10:00 · 예약 발송</small></div>
      </div>
      <h1>[자동 발송] 도윤아</h1>
      <div class="intro-body">
        <p>이 메일이 도착했다면, 나는 사흘 동안 로그인하지 못한 거야.</p>
        <p>첨부한 건 11월 20일 밤의 내 PC야. 켜면 그날 밤 10시부터 자정까지가 그대로 다시 재생돼. 자정이 되면 처음으로 돌아가. 몇 번이든.</p>
        <p>그날 밤에 무슨 일이 있었는지, 네가 대신 봐 줘.</p>
        <p class="sign">— 누나</p>
      </div>
      <div class="intro-att">${icon('zip', 34)}<div><b>COLD_BOOT_20261120.vmimg</b><small>38.2GB · 가상 머신 이미지</small></div></div>
      <button class="mac-btn" data-a="intro-go">첨부 파일 열기</button>
    </div>
    <p class="intro-note">11월 25일 새벽. 누나와 연락이 끊긴 지 닷새째.</p>`;
}

let bootTimer = null;

function showBootLog() {
  const el = $('#boot');
  el.className = 'boot-mode';
  const n = Object.keys(save.clues).length;
  const d = Object.keys(save.deds).length;
  const tip = BOOT_TIPS[Math.min(save.loop - 1, BOOT_TIPS.length - 1)];
  const lines = [
    ['cmd', 'coldboot replay ~/Downloads/COLD_BOOT_20261120.vmimg'],
    ['', 'COLD_BOOT 0.3.1 (personal build, han.seojin)'],
    ['dim', '"재생은 바꿀 수 없어. 하지만 보는 건 몇 번이고 할 수 있어."'],
    ['', ''],
    ['ok', '이미지 확인       COLD_BOOT_20261120.vmimg  38.2GB  SHA-256 일치'],
    ['ok', '스냅샷 복원       2026-11-20 (금) 22:00:00 KST'],
    ['ok', `기록 적재         메신저 ${COUNT.msg} · 메일 ${COUNT.mail} · 시스템 로그 ${COUNT.log} · 파일 변경 1`],
    ['ok', '재생 모드         읽기 전용 (기록된 사건은 바뀌지 않음)'],
    ['warn', '기록 종료 지점    23:58:12  원격 초기화 감지'],
    ['ok', `수사 노트         단서 ${n} · 추론 ${d} · 보고서 ${save.stage}/3`],
    ['', ''],
    ['big', `loop ${pad2(save.loop)} 준비 완료`],
    ['dim', `# ${tip}`],
    ['prompt', ''],
  ];

  el.innerHTML = `${MAC_MENU('터미널')}
    <div class="mac-win term">
      <div class="mac-bar"><span class="mac-dots"><i></i><i></i><i></i></span><span>doyun — coldboot — 96×24</span></div>
      <div class="term-body" id="boot-log"></div>
      <div class="term-actions" id="boot-start-row" hidden>Enter 키를 눌러도 됩니다 <button class="mac-btn" data-a="boot-start" id="boot-start">재생 시작</button></div>
    </div>`;

  const PROMPT = '<span class="p">doyun@MacBook-Air ~ %</span> ';
  const line = ([cls, txt]) => {
    const div = document.createElement('div');
    div.className = 'bl ' + cls;
    if (cls === 'cmd') div.innerHTML = PROMPT + esc(txt);
    else if (cls === 'prompt') { div.innerHTML = PROMPT; div.classList.add('cursor'); }
    else if (cls === 'ok') div.innerHTML = '<span class="ok">[ok]  </span>' + esc(txt);
    else if (cls === 'warn') div.innerHTML = '<span class="warn">[warn]</span>' + esc(txt);
    else div.innerHTML = esc(txt) || '&nbsp;';
    return div;
  };

  const log = $('#boot-log');
  let i = 0;
  const step = () => {
    if (i >= lines.length) { finishBoot(); return; }
    log.appendChild(line(lines[i]));
    i += 1;
    bootTimer = setTimeout(step, i === 1 ? 500 : lines[i - 1][1] ? 70 + Math.random() * 130 : 50);
  };
  el.dataset.done = '';
  el.skip = () => {
    clearTimeout(bootTimer);
    while (i < lines.length) { log.appendChild(line(lines[i])); i += 1; }
    finishBoot();
  };
  bootTimer = setTimeout(step, 350);
}

function finishBoot() {
  const el = $('#boot');
  el.dataset.done = '1';
  Sound.sfx('beep');
  $('#boot-start-row').hidden = false;
  $('#boot-start').focus();
}

// 터미널 → Windows 잠금 화면
function startLoop() {
  const el = $('#boot');
  if (running || el.hidden || el.classList.contains('leaving')) return;
  el.classList.add('leaving');
  showLock();
  setTimeout(() => {
    el.hidden = true;
    el.classList.remove('leaving');
  }, 400);
}

function showLock() {
  const el = $('#lock');
  el.className = '';
  el.dataset.step = 'lock';
  const tip = BOOT_TIPS[Math.min(save.loop - 1, BOOT_TIPS.length - 1)];
  el.innerHTML = `
    <div class="lock-bg"></div>
    <div class="lock-clock"><b>10:00</b><span>11월 20일 금요일</span></div>
    <div class="lock-hint"><b>클릭하거나 아무 키나 누르면 로그인합니다</b><em>LOOP ${pad2(save.loop)} · ${esc(tip)}</em></div>
    <div class="lock-tray">
      <svg width="18" height="18" viewBox="0 0 24 24"><path d="M2.5 9a14 14 0 0 1 19 0M5.8 12.4a9.3 9.3 0 0 1 12.4 0M9.1 15.8a4.6 4.6 0 0 1 5.8 0" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round"/><circle cx="12" cy="19.3" r="1.4" fill="#fff"/></svg>
      <svg width="20" height="18" viewBox="0 0 28 24"><rect x="2" y="6" width="21" height="12" rx="2.5" fill="none" stroke="#fff" stroke-width="1.6"/><rect x="4.5" y="8.5" width="11" height="7" rx="1" fill="#fff"/><path d="M25 10v4" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/></svg>
    </div>
    <div class="signin">
      <div class="si-av">서</div>
      <div class="si-name">한서진</div>
      <div class="si-pin"><i></i><i></i><i></i><i></i><i></i><i></i></div>
      <div class="si-msg" id="si-msg"></div>
    </div>`;
  el.hidden = false;
}

// 잠금 화면 → 로그인 → 바탕 화면, 재생 시작
function signIn() {
  const el = $('#lock');
  if (el.hidden || el.dataset.step !== 'lock') return;
  el.dataset.step = 'signin';
  el.classList.add('in');
  Sound.sfx('pick');
  setTimeout(() => {
    $('#si-msg').innerHTML = '<div class="win-spin" style="margin:0 auto 8px"><i></i><i></i><i></i><i></i><i></i></div>환영합니다';
  }, 1600);
  setTimeout(() => {
    el.hidden = true;
    running = true;
    lastFrame = performance.now();
    Sound.sfx('start');
    htoast({ ic: 'term', app: 'COLD_BOOT', title: `LOOP ${pad2(save.loop)} 재생 시작`, text: '자정까지 120분' });
    if (save.loop === 1 && !Object.keys(save.clues).length) {
      setTimeout(() => htoast({ title: '수사하는 법', text: '중요한 것엔 📌 핀을 꽂고, 글 속 단어는 눌러서 모으세요.' }), 1200);
    }
  }, 3000);
}

/* ---------------------------------------------------------
   11. 수사 노트와 보고서
   --------------------------------------------------------- */

function openNotes() {
  if (transitioning || !$('#boot').hidden || !$('#lock').hidden) return;
  notesOpen = true;
  paused = true;
  $('#htoasts').innerHTML = '';
  closeStart();
  renderNotes();
  $('#notes').classList.add('open');
  $('#veil').hidden = false;
  Sound.sfx('page');
  Sound.muffle(true);
}

function closeNotes() {
  notesOpen = false;
  paused = false;
  lastFrame = performance.now();
  resetArmed = false;
  newClues.clear();
  $('#notes').classList.remove('open');
  $('#veil').hidden = true;
  boardSel = null;
  boardPair = null;
  boardMsg = null;
  activeBlank = null;
  Sound.muffle(false);
}

function clueCard(id) {
  const c = CLUES[id];
  return `<article class="clue ${newClues.has(id) ? 'new' : ''}">
    <time>${c.t || '자료'}</time>
    <div>
      <h4>${esc(c.title)}</h4>
      <p>${esc(c.body)}</p>
      <small>${esc(c.src)} · LOOP ${pad2(save.clues[id])}에서 발견</small>
    </div>
  </article>`;
}

/* 연결 보드 */
let boardSel = null;          // 첫 번째로 고른 카드
let boardPair = null;         // 연결고리 단어를 고르는 중인 두 카드
let boardMsg = null;          // { kind, text }
let boardFresh = null;        // 방금 생긴 추론 카드
let activeBlank = null;       // 보고서에서 채우는 중인 빈칸

const cardOf = id => DEDUCTIONS.find(d => d.id === id) || CLUES[id];

function boardCard(id) {
  const ded = DEDUCTIONS.find(d => d.id === id);
  const c = cardOf(id);
  const on = boardSel === id || (boardPair && boardPair.includes(id));
  return `<button class="bcard ${ded ? 'ded' : 'clu'} ${on ? 'sel' : ''} ${boardFresh === id ? 'fresh' : ''}" data-a="board" data-id="${id}" title="${esc(c.body)}">
    <i class="pin"></i>
    <span class="bc-top">${ded ? '추론' : esc(c.t || '자료')}</span>
    <b>${esc(c.title)}</b>
    <span class="bc-body">${esc(c.body)}</span>
  </button>`;
}

// 단어 카드 묶음 (연결 보드와 보고서 공통)
function wordBank(action, onlyType = null) {
  const words = [...knownWords()];
  return `<div class="bank">${Object.keys(TYPE_LABEL).map(t => {
    const ws = words.filter(w => WORDS[w] === t);
    if (!ws.length) return '';
    const off = onlyType && onlyType !== t;
    return `<div class="bank-row ${off ? 'off' : ''}"><small>${TYPE_LABEL[t]}</small>${ws.map(w =>
      `<button class="chip t-${t}" data-a="${action}" data-w="${esc(w)}" ${off ? 'disabled' : ''}>${esc(w)}</button>`).join('')}</div>`;
  }).join('')}</div>`;
}

function renderBoard() {
  const deds = DEDUCTIONS.filter(d => save.deds[d.id]).map(d => d.id);
  const clues = Object.keys(save.clues).sort((a, b) => (CLUES[a].t ? tm(CLUES[a].t) : -1) - (CLUES[b].t ? tm(CLUES[b].t) : -1));
  const msg = boardMsg ? `<p class="board-msg ${boardMsg.kind}">${esc(boardMsg.text)}</p>` : '';
  const top = boardPair
    ? `<div class="link-ask">
        <p><b>${esc(cardOf(boardPair[0]).title)}</b><span>↔</span><b>${esc(cardOf(boardPair[1]).title)}</b></p>
        <h6>두 단서를 잇는 연결고리는 무엇인가?</h6>
        ${wordBank('link-word')}
        <button class="link-cancel" data-a="link-cancel">취소</button>
      </div>`
    : `<p class="board-lead">카드 두 장을 고른 뒤, 둘을 잇는 <b>연결고리 단어</b>를 고르세요. 맞으면 <b>추론 카드</b>가 생깁니다. 추론 카드끼리도 이을 수 있습니다.</p>${msg}`;
  return `<div class="board" id="board">
    <svg class="thread" id="thread" aria-hidden="true"></svg>
    <div class="board-top">${top}</div>
    <h5>추론 <i>${deds.length}/${DEDUCTIONS.length}</i></h5>
    <div class="bgrid">${deds.length ? deds.map(boardCard).join('') : '<p class="nb-empty small">아직 없습니다.</p>'}</div>
    <h5>단서 <i>${clues.length}</i></h5>
    <div class="bgrid">${clues.length ? clues.map(boardCard).join('') : '<p class="nb-empty small">📌 핀을 꽂은 단서가 이곳에 붙습니다.</p>'}</div>
  </div>`;
}

function pickBoard(id, el) {
  if (boardPair) return;
  if (!boardSel) {
    boardSel = id;
    boardMsg = null;
    el.classList.add('sel');
    Sound.sfx('pick');
    return;
  }
  if (boardSel === id) {
    boardSel = null;
    el.classList.remove('sel');
    return;
  }
  boardPair = [boardSel, id];
  boardSel = null;
  Sound.sfx('pick');
  renderNotes();
}

function linkWord(word) {
  const [a, b] = boardPair;
  boardPair = null;
  const hit = DEDUCTIONS.find(d => d.pairs.some(([x, y]) => (x === a && y === b) || (x === b && y === a)));

  if (hit && save.deds[hit.id]) {
    boardMsg = { kind: 'warn', text: `이미 이어 본 연결입니다 → "${hit.title}"` };
    renderNotes();
    return;
  }
  if (!hit || !hit.key.includes(word)) {
    save.misses = (save.misses || 0) + 1;
    persist();
    boardMsg = {
      kind: 'bad',
      text: hit
        ? `두 단서는 어딘가 이어져 있는 것 같다. 하지만 "${word}"(으)로는 설명되지 않는다.`
        : `"${word}"(으)로 두 단서를 이을 수 없다.`,
    };
    Sound.sfx('error');
    renderNotes();
    return;
  }

  // 성공: 실을 잇고 추론 카드를 만든다
  boardMsg = null;
  renderNotes();
  drawThread($(`.bcard[data-id="${a}"]`), $(`.bcard[data-id="${b}"]`), true);
  Sound.sfx('connect');
  setTimeout(() => {
    save.deds[hit.id] = save.loop;
    persist();
    boardFresh = hit.id;
    boardMsg = { kind: 'ok', text: `새 추론: ${hit.title}${hit.w.length ? ` · 단어 +${hit.w.length}` : ''}` };
    updateNotesCount();
    renderNotes();
  }, 700);
}

// 두 카드 사이에 빨간 실 긋기
function drawThread(a, b, ok) {
  const svg = $('#thread');
  const board = $('#board');
  if (!svg || !a || !b || !board) return;
  const r0 = board.getBoundingClientRect();
  const p = el => {
    const r = el.getBoundingClientRect();
    return [(r.left + r.width / 2 - r0.left) / scale, (r.top + 10 - r0.top) / scale];
  };
  const [x1, y1] = p(a);
  const [x2, y2] = p(b);
  const sag = Math.min(60, Math.abs(x2 - x1) * 0.2 + 24);
  svg.innerHTML = `<path class="${ok ? 'ok' : 'no'}" d="M${x1} ${y1} Q${(x1 + x2) / 2} ${Math.max(y1, y2) + sag} ${x2} ${y2}"/>`;
}

/* 3단계 보고서 */
const stageMsg = {};

function renderReport() {
  let activeType = null;
  const stagesHtml = STAGES.map((st, i) => {
    const done = i < save.stage;
    const locked = i > save.stage;
    if (locked) {
      return `<section class="stage locked"><header><span>${i + 1}단계</span><b>${esc(st.title)}</b></header><p class="stage-lock">${i}단계 보고서가 받아들여지면 열립니다.</p></section>`;
    }
    const lines = st.lines.map(line => `<p class="sent">${line.map(part => {
      if (typeof part === 'string') return esc(part);
      if (done) return `<span class="fill">${esc(part.a)}</span>`;
      const cur = save.answers[part.b] || '';
      const on = activeBlank === part.b;
      if (on) activeType = part.type;
      return `<button class="blank ${cur ? 'set' : ''} ${on ? 'on' : ''}" data-a="blank" data-b="${part.b}">${cur ? esc(cur) : TYPE_LABEL[part.type]}</button>`;
    }).join('')}</p>`).join('');
    const proof = st.need.map(d => {
      const ok = save.deds[d];
      return `<span class="proof ${ok ? 'ok' : ''}">${ok ? '✓ ' + esc(DEDUCTIONS.find(x => x.id === d).title) : '? 증명 필요'}</span>`;
    }).join('');
    const m = stageMsg[i];
    return `<section class="stage ${done ? 'done' : ''}">
      <header><span>${i + 1}단계</span><b>${esc(st.title)}</b>${done ? '<em class="seal">확인됨</em>' : ''}</header>
      ${lines}
      <div class="proofs"><small>근거</small>${proof}</div>
      ${done
        ? (st.reveal ? `<p class="stage-reveal">${esc(st.reveal)}</p>` : '')
        : `<button class="rep-submit" data-a="stage-submit" data-stage="${i}">${i + 1}단계 보고서 제출</button>
           <p class="rep-msg ${m ? m.kind : ''}" aria-live="polite">${m ? esc(m.text) : ''}</p>`}
    </section>`;
  }).join('');

  const dock = save.stage < 3
    ? `<div class="bank-dock">
        <p>${activeBlank ? `<b>${TYPE_LABEL[activeType]}</b> 칸에 넣을 단어를 고르세요` : '빈칸을 누른 뒤, 아래에서 단어를 고르세요'}
          ${activeBlank ? '<button class="chip-clear" data-a="chip-clear">칸 비우기</button>' : ''}</p>
        ${wordBank('chip', activeBlank ? activeType : null)}
      </div>`
    : '';

  return `<div class="rep">
    <p class="rep-lead">빈칸에는 <b>글 속에서 직접 눌러 모은 단어</b>만 넣을 수 있습니다. 내용이 맞아도 연결 보드에서 증명하지 못하면 받아들여지지 않습니다.</p>
    ${stagesHtml}
    ${dock}
  </div>`;
}

function fillBlank(word) {
  if (!activeBlank) return;
  save.answers[activeBlank] = word;
  // 같은 단계의 다음 빈칸으로
  const st = STAGES.find(s => s.lines.flat().some(p => typeof p === 'object' && p.b === activeBlank));
  const blanks = st.lines.flat().filter(p => typeof p === 'object');
  const next = blanks.find(p => !save.answers[p.b]);
  activeBlank = next ? next.b : null;
  persist();
  Sound.sfx('pick');
  renderNotes();
}

function submitStage(i) {
  const st = STAGES[i];
  const blanks = st.lines.flat().filter(x => typeof x === 'object');
  if (blanks.some(b => !save.answers[b.b])) {
    stageMsg[i] = { kind: 'warn', text: '빈칸을 모두 채워 주세요.' };
    renderNotes();
    return;
  }
  save.reports += 1;
  persist();
  if (!blanks.every(b => save.answers[b.b] === b.a)) {
    stageMsg[i] = { kind: 'bad', text: '반려 · 사실과 맞지 않는 내용이 있습니다. 어느 곳인지는 알려 주지 않습니다.' };
    Sound.sfx('reject');
    renderNotes();
    return;
  }
  const missing = st.need.filter(d => !save.deds[d]);
  if (missing.length) {
    stageMsg[i] = { kind: 'warn', text: `내용은 맞는 것 같습니다. 하지만 증명되지 않은 부분이 ${missing.length}곳 있습니다. 연결 보드에서 근거를 이어 주세요.` };
    Sound.sfx('reject');
    renderNotes();
    return;
  }
  save.stage = i + 1;
  persist();
  delete stageMsg[i];
  Sound.sfx('stamp');
  renderNotes();
  if (i === 1) setTimeout(showTwist, 700);
  if (i === 2) setTimeout(showEnding, 1300);
}

// 2단계 반전 화면
function showTwist() {
  closeNotes();
  paused = true;
  Sound.sfx('twist');
  const el = $('#twist');
  el.innerHTML = `<div class="twist-inner">
    <small>REPORT 02 · ACCEPTED</small>
    <h1>강준혁은 <em>피해자가 아니었다.</em></h1>
    <ol>
      <li><b>09:12</b> 사건 당일 아침, 자기 관리자 계정을 하린에게 넘긴다.</li>
      <li><b>22:50</b> 처가가 있는 부산으로 가는 KTX에서 "노트북을 두고 왔다"고 알린다.</li>
      <li><b>23:55</b> 하린이 그 계정으로 버튼을 누른다. 기록에는 kang.jh만 남는다.</li>
    </ol>
    <p>4억 2천만 원은 그의 아내 윤서영의 회사로 흘러갔다. 문태경은 승인했고, 하린은 실행했고, 강준혁은 처음부터 빠져나갈 길을 만들어 두었다.</p>
    <p class="twist-q">이제 남은 질문은 하나. <b>서진은 어디에 있나.</b></p>
    <button data-a="twist-close">계속 수사하기</button>
  </div>`;
  el.hidden = false;
}

function renderNotes() {
  const ids = Object.keys(save.clues);
  const total = Object.keys(CLUES).length;
  let body = '';

  if (notesTab === 'timeline') {
    const timed = ids.filter(id => CLUES[id].t).sort((a, b) => tm(CLUES[a].t) - tm(CLUES[b].t));
    body = timed.length
      ? `<div class="tl-list">${timed.map(clueCard).join('')}</div>`
      : '<p class="nb-empty">아직 시각이 확인된 사건이 없습니다. 무언가를 보는 순간 이곳에 적힙니다.</p>';
    body += `<label class="nb-memo"><span>다음 회차 계획</span><textarea id="nb-memo" rows="4" placeholder="예) 23:40 전에 하린 대화창 열어 두기">${esc(save.memo)}</textarea></label>`;
  } else if (notesTab === 'files') {
    const docs = ids.filter(id => !CLUES[id].t);
    body = docs.length
      ? docs.map(clueCard).join('')
      : '<p class="nb-empty">파일, 메일, 사진에서 얻은 자료가 이곳에 모입니다.</p>';
  } else if (notesTab === 'board') {
    body = renderBoard();
  } else {
    body = renderReport();
  }

  const hint = nextHint();
  const prev = $('#notes .nb-body');
  const keepTop = prev && lastNotesTab === notesTab ? prev.scrollTop : 0;
  $('#notes').classList.toggle('wide', notesTab === 'board' || notesTab === 'report');
  $('#notes').innerHTML = `
    <div class="nb-mac"><span class="mac-dots"><i></i><i></i><i></i></span><span>수사 노트 — 도윤의 MacBook</span></div>
    <header class="nb-head">
      <div><small>HOST · 가상 PC 바깥</small><h2>수사 노트</h2></div>
      <button class="nb-close" data-a="notes-close" aria-label="수사 노트 닫기">${SVG_X}</button>
    </header>
    <div class="nb-stats">
      <span><small>회차</small><b>LOOP ${pad2(save.loop)}</b></span>
      <span><small>단서</small><b>${ids.length}<i>/${total}</i></b></span>
      <span><small>추론</small><b>${Object.keys(save.deds).length}<i>/${DEDUCTIONS.length}</i></b></span>
      <span><small>보고서</small><b>${save.stage}<i>/3</i></b></span>
    </div>
    <nav class="nb-tabs">
      <button class="${notesTab === 'timeline' ? 'on' : ''}" data-a="tab" data-tab="timeline">타임라인</button>
      <button class="${notesTab === 'files' ? 'on' : ''}" data-a="tab" data-tab="files">자료</button>
      <button class="${notesTab === 'board' ? 'on' : ''}" data-a="tab" data-tab="board">연결 보드</button>
      <button class="${notesTab === 'report' ? 'on' : ''}" data-a="tab" data-tab="report">보고서</button>
    </nav>
    <div class="nb-body">${body}</div>
    <footer class="nb-foot">
      ${hint ? `<button class="nb-hint" data-a="hint">막혔을 때 힌트</button>` : ''}
      <p class="nb-hint-text" id="nb-hint-text" hidden></p>
      <button class="nb-reset" data-a="reset">${resetArmed ? '정말 지울까요? 한 번 더 누르세요' : '기록 전부 지우고 처음부터'}</button>
    </footer>`;
  $('#notes .nb-body').scrollTop = keepTop;
  lastNotesTab = notesTab;
  boardFresh = null;
}

function resetAll() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* 무시 */ }
  save = defaultSave();
  notesTab = 'timeline';
  if (notesOpen) closeNotes();
  $('#ending').hidden = true;
  boot();
}


/* ---------------------------------------------------------
   12. 엔딩
   --------------------------------------------------------- */

function showEnding() {
  running = false;
  if (notesOpen) closeNotes();
  save.solved = true;
  persist();
  Sound.sfx('ending');
  const n = Object.keys(save.clues).length;
  const total = Object.keys(CLUES).length;
  const el = $('#ending');
  el.innerHTML = `
    <div class="end-sky"><div class="end-sun"></div><svg class="end-hills" viewBox="0 0 1280 260" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 140C180 60 320 110 470 90 640 40 760 110 920 80 1080 50 1180 100 1280 70V260H0Z" fill="#2b2a4f"/>
      <path d="M0 190C160 150 300 170 460 160 640 130 800 180 980 150 1120 130 1220 160 1280 150V260H0Z" fill="#1b1a36"/>
      <path d="M880 170h120v-46l-60-34-60 34z" fill="#121128"/><rect x="926" y="128" width="16" height="12" fill="#f2b45a" opacity=".9"/>
    </svg></div>
    <div class="end-inner">
      <small>11월 25일 · 오전 5시 41분 · 충북 제천</small>
      <h1>사다리는 치워져 있었다.</h1>
      <div class="end-text">
        <p>창고 문을 열자 먼지 냄새가 먼저 났다. 위를 보고 이름을 부르자, 한참 뒤에 다락 판자가 밀려났다.</p>
        <p>"늦었네." 서진은 손전등을 끄며 말했다. 손에는 SanDisk USB가 들려 있었다.</p>
        <p>"강릉 간다고 했잖아. 하린이한테." 도윤이 말하자 서진이 웃었다. "그러니까 여기 있지."</p>
        <p>그날 오후, 도윤의 보고서와 USB 원본은 금융감독원과 경찰에 함께 넘겨졌다. 초기화 명령을 보낸 기기는 QA-HARIN-01, 송금을 승인한 계정은 moon.tk, 돈을 받은 에버그린 홀딩스의 대표는 강준혁의 아내 윤서영이었다. 부산행 KTX 표는 알리바이가 아니라 미리 짜 둔 각본이었다.</p>
        <p>COLD_BOOT 이미지는 그 뒤로 다시 켜지지 않았다.</p>
      </div>
      <dl class="end-stats">
        <div><dt>리플레이</dt><dd>${save.loop}회</dd></div>
        <div><dt>찾은 단서</dt><dd>${n}/${total}</dd></div>
        <div><dt>추론</dt><dd>${Object.keys(save.deds).length}/${DEDUCTIONS.length}</dd></div>
        <div><dt>보고서 제출</dt><dd>${save.reports}회</dd></div>
        <div><dt>헛짚음</dt><dd>${save.misses || 0}번</dd></div>
      </dl>
      <div class="end-actions">
        <button data-a="restart-all" class="primary">처음부터 다시</button>
        <button data-a="end-close">계속 둘러보기</button>
      </div>
    </div>`;
  el.hidden = false;
}


/* ---------------------------------------------------------
   13. 배경 (도시, 비)
   --------------------------------------------------------- */

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function buildCity() {
  const rnd = mulberry32(20261120);
  const layers = [
    { base: 712, min: 150, max: 330, wmin: 34, wmax: 80, fill: '#111a33', lit: 0.07, wc: ['#5d78c4', '#7f95d8'], step: 10 },
    { base: 712, min: 90, max: 250, wmin: 50, wmax: 110, fill: '#0b1226', lit: 0.12, wc: ['#f2c46a', '#ffdf9e', '#9fb7ff'], step: 13 },
    { base: 712, min: 50, max: 150, wmin: 70, wmax: 150, fill: '#070b18', lit: 0.18, wc: ['#ffcf7a', '#ffe7b0', '#ff9f6b'], step: 15 },
  ];
  let svg = '';
  let flick = 0;
  layers.forEach((L, li) => {
    let x = -20;
    while (x < W + 20) {
      const bw = L.wmin + rnd() * (L.wmax - L.wmin);
      const bh = L.min + rnd() * (L.max - L.min);
      const top = L.base - bh;
      svg += `<rect x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" fill="${L.fill}"/>`;
      // 옥상 구조물
      if (rnd() < 0.35) svg += `<rect x="${(x + bw * 0.2).toFixed(1)}" y="${(top - 10).toFixed(1)}" width="${(bw * 0.25).toFixed(1)}" height="10" fill="${L.fill}"/>`;
      if (li === 0 && rnd() < 0.18) svg += `<circle class="beacon" cx="${(x + bw / 2).toFixed(1)}" cy="${(top - 4).toFixed(1)}" r="2.2" fill="#ff4d5e" style="animation-delay:${(rnd() * 2).toFixed(2)}s"/>`;
      // 창문
      for (let wy = top + 10; wy < L.base - 10; wy += L.step) {
        for (let wx = x + 6; wx < x + bw - 8; wx += L.step - 3) {
          if (rnd() < L.lit) {
            const c = L.wc[Math.floor(rnd() * L.wc.length)];
            const fl = rnd() < 0.05 && flick < 26;
            if (fl) flick += 1;
            svg += `<rect ${fl ? `class="fl" style="animation-delay:${(rnd() * 6).toFixed(2)}s"` : ''} x="${wx.toFixed(1)}" y="${wy.toFixed(1)}" width="${(L.step - 8).toFixed(1)}" height="${(L.step - 7).toFixed(1)}" fill="${c}" opacity="${(0.45 + rnd() * 0.5).toFixed(2)}"/>`;
          }
        }
      }
      x += bw + rnd() * 6;
    }
  });
  $('#city').innerHTML = svg;
}

const rain = { ctx: null, drops: [], splashes: [] };

function newDrop(anywhere) {
  const z = Math.random();
  return {
    x: Math.random() * (W + 200) - 40,
    y: anywhere ? Math.random() * 712 : -30 - Math.random() * 200,
    len: 10 + z * 22,
    v: 480 + z * 520,
    a: 0.07 + z * 0.22,
    z,
  };
}

function initRain() {
  rain.ctx = $('#rain').getContext('2d');
  const n = REDUCED ? 60 : 230;
  for (let i = 0; i < n; i += 1) rain.drops.push(newDrop(true));
}

function drawRain(dt) {
  const ctx = rain.ctx;
  if (!ctx || document.hidden) return;
  ctx.clearRect(0, 0, W, 712);
  ctx.lineCap = 'round';
  const slant = 0.2;
  rain.drops.forEach((d, i) => {
    d.y += d.v * dt;
    d.x -= d.v * dt * slant;
    ctx.strokeStyle = `rgba(190,208,255,${d.a})`;
    ctx.lineWidth = 0.8 + d.z * 0.7;
    ctx.beginPath();
    ctx.moveTo(d.x, d.y);
    ctx.lineTo(d.x + d.len * slant, d.y - d.len);
    ctx.stroke();
    if (d.y > 700) {
      if (d.z > 0.55 && rain.splashes.length < 40) rain.splashes.push({ x: d.x, y: 704 - Math.random() * 6, r: 0, a: d.a + 0.1 });
      rain.drops[i] = newDrop(false);
    }
  });
  rain.splashes = rain.splashes.filter(s => {
    s.r += dt * 26;
    s.a -= dt * 0.9;
    if (s.a <= 0) return false;
    ctx.strokeStyle = `rgba(200,216,255,${s.a})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(s.x, s.y, s.r, s.r * 0.3, 0, Math.PI, Math.PI * 2);
    ctx.stroke();
    return true;
  });
}


/* ---------------------------------------------------------
   14. 입력 연결과 시작
   --------------------------------------------------------- */

// 글 속 단어 모으기
document.addEventListener('click', e => {
  const k = e.target.closest('.kw');
  if (k) collectWord(k.dataset.w, e);
}, true);

// 버튼 클릭 (data-a)
document.addEventListener('click', e => {
  const t = e.target.closest('[data-a]');
  if (!t) return;
  const a = t.dataset.a;
  const w = winOf(t);

  switch (a) {
    case 'win-min': minimizeWin(w); break;
    case 'win-max': w.el.classList.toggle('max'); break;
    case 'ev': w.data.sel = +t.dataset.i; renderWin(w); break;
    case 'power': powerOpen = !powerOpen; openStart(); break;
    case 'sm-file': closeStart(); openFile(vm.files[t.dataset.dir][+t.dataset.i]); break;
    case 'win-close': closeWin(w); break;
    case 'chat': w.data.chat = t.dataset.chat; renderWin(w); refreshBadges(); break;
    case 'mail': w.data.sel = t.dataset.id; renderWin(w); refreshBadges(); break;
    case 'dir': w.data.dir = t.dataset.dir; w.data.selIdx = null; renderWin(w); break;
    case 'file': {
      const i = +t.dataset.i;
      if (COARSE) { openFile(vm.files[w.data.dir][i]); break; }
      w.data.selIdx = i;
      $$('.file', w.body).forEach(f => f.classList.toggle('sel', f === t));
      const f = vm.files[w.data.dir][i];
      $('.exp-sel', w.body).textContent = `1개 항목 선택함  ${f.size}`;
      break;
    }
    case 'zip-csv': openApp('csv', { data: { clue: 'ledger' } }); break;
    case 'zip-letter': openApp('doc', { id: 'doc:letter', title: '도윤에게.txt — 메모장', data: { doc: 'letter', clue: 'letter' } }); break;
    case 'sm-app': closeStart(); launch(t.dataset.key); break;
    case 'sm-notes': closeStart(); openNotes(); break;
    case 'rewind': closeStart(); endLoop('manual'); break;
    case 'notes-close': closeNotes(); break;
    case 'tab': notesTab = t.dataset.tab; boardSel = null; boardPair = null; boardMsg = null; activeBlank = null; renderNotes(); Sound.sfx('page'); break;
    case 'pin': pinItem(t); break;
    case 'link-word': linkWord(t.dataset.w); break;
    case 'link-cancel': boardPair = null; renderNotes(); break;
    case 'blank': activeBlank = t.dataset.b; Sound.sfx('pick'); renderNotes(); break;
    case 'chip': fillBlank(t.dataset.w); break;
    case 'chip-clear': if (activeBlank) { delete save.answers[activeBlank]; persist(); renderNotes(); } break;
    case 'board': pickBoard(t.dataset.id, t); break;
    case 'stage-submit': submitStage(+t.dataset.stage); break;
    case 'twist-close':
      $('#twist').hidden = true;
      paused = false;
      lastFrame = performance.now();
      break;
    case 'sound': toggleSound(); break;
    case 'hint': {
      const p = $('#nb-hint-text');
      if (p) { p.textContent = nextHint(); p.hidden = false; t.hidden = true; }
      break;
    }
    case 'reset':
      if (resetArmed) resetAll();
      else { resetArmed = true; renderNotes(); }
      break;
    case 'intro-go': save.intro = true; persist(); showBootLog(); break;
    case 'boot-start': startLoop(); break;
    case 'restart-all': resetAll(); break;
    case 'end-close':
      $('#ending').hidden = true;
      running = vm.t < LOOP_LEN;
      lastFrame = performance.now();
      break;
  }
});

// 더블클릭으로 파일 열기
document.addEventListener('dblclick', e => {
  const f = e.target.closest('[data-a="file"]');
  if (f) {
    const w = winOf(f);
    openFile(vm.files[w.data.dir][+f.dataset.i]);
  }
});

// 바탕화면 아이콘
$('#icons').addEventListener('click', e => {
  const b = e.target.closest('[data-desk]');
  if (!b) return;
  if (COARSE) { openDesk(b.dataset.desk); return; }
  deskSel = b.dataset.desk;
  $$('.dicon').forEach(x => x.classList.toggle('sel', x === b));
});
$('#icons').addEventListener('dblclick', e => {
  const b = e.target.closest('[data-desk]');
  if (b) openDesk(b.dataset.desk);
});
$('#icons').addEventListener('keydown', e => {
  const b = e.target.closest('[data-desk]');
  if (b && e.key === 'Enter') { e.preventDefault(); openDesk(b.dataset.desk); }
});
$('#wall').addEventListener('click', () => {
  deskSel = null;
  $$('.dicon').forEach(x => x.classList.remove('sel'));
});

// 작업 표시줄
$('#tb-apps').addEventListener('click', e => {
  const b = e.target.closest('[data-tb], [data-tbw]');
  if (!b) return;
  let w = null;
  if (b.dataset.tbw) w = wins.get(b.dataset.tbw);
  else w = [...wins.values()].filter(x => x.app === b.dataset.tb).sort((p, q) => +q.el.style.zIndex - +p.el.style.zIndex)[0];
  if (!w) { launch(b.dataset.tb); return; }
  if (w.id === focusedId && !w.min) minimizeWin(w);
  else { w.min = false; w.el.classList.remove('min'); focusWin(w); renderWin(w); }
});

$('#btn-start').addEventListener('click', () => {
  if ($('#startmenu').hidden) openStart(); else closeStart();
});
$('#btn-notes').addEventListener('click', () => {
  if (notesOpen) closeNotes(); else openNotes();
});
$('#speed').addEventListener('click', e => {
  const b = e.target.closest('[data-speed]');
  if (!b) return;
  speed = +b.dataset.speed;
  $$('#speed button').forEach(x => x.classList.toggle('on', x === b));
});
$('#veil').addEventListener('click', closeNotes);

// 부팅 화면: 클릭하면 로그를 건너뜀
$('#boot').addEventListener('click', e => {
  const el = $('#boot');
  if (e.target.closest('[data-a]')) return;
  if (el.classList.contains('boot-mode') && !el.dataset.done && el.skip) el.skip();
});

// 폼 (압축 암호, 보고서)
document.addEventListener('submit', e => {
  const form = e.target;
  e.preventDefault();
  if (form.dataset.form === 'zip') {
    const w = winOf(form);
    const pw = new FormData(form).get('pw').trim().toLowerCase();
    if (pw === 'jecheon0807') {
      vm.unlocked = true;
      Sound.sfx('unlock');
      closeWin(w);
      openApp('zipdir', { data: { clue: 'zip' } });
    } else {
      w.data.err = true;
      Sound.sfx('error');
      renderWin(w);
      const input = $('input', w.body);
      if (input) input.focus();
    }
  }
});

// 다음 회차 계획 메모 저장
document.addEventListener('input', e => {
  if (e.target.id === 'nb-memo') {
    save.memo = e.target.value;
    persist();
  }
});

// 보고서 빈칸 고르기, 암호 표시
document.addEventListener('change', e => {
  if (e.target.matches('[data-pwshow]')) {
    const input = $('input[name="pw"]', e.target.closest('form'));
    if (input) input.type = e.target.checked ? 'text' : 'password';
    return;
  }
});

// 창 끌기와 포커스
let drag = null;
document.addEventListener('pointerdown', e => {
  const box = e.target.closest('.win');
  if (box) focusWin(wins.get(box.dataset.id));
  const bar = e.target.closest('.titlebar');
  if (bar && box && !e.target.closest('button') && !box.classList.contains('max')) {
    const w = wins.get(box.dataset.id);
    drag = { w, sx: e.clientX, sy: e.clientY, x: w.el.offsetLeft, y: w.el.offsetTop };
    w.el.classList.add('dragging');
    e.preventDefault();
  }
  if (!e.target.closest('#startmenu') && !e.target.closest('#btn-start')) closeStart();
});
document.addEventListener('pointermove', e => {
  if (!drag) return;
  const el = drag.w.el;
  const x = clamp(drag.x + (e.clientX - drag.sx) / scale, -el.offsetWidth + 100, W - 100);
  const y = clamp(drag.y + (e.clientY - drag.sy) / scale, 0, H - TASKBAR - 36);
  el.style.left = x + 'px';
  el.style.top = y + 'px';
});
const endDrag = () => {
  if (drag) { drag.w.el.classList.remove('dragging'); drag = null; }
};
document.addEventListener('pointerup', endDrag);
document.addEventListener('pointercancel', endDrag);

// 키보드
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (notesOpen) closeNotes();
    closeStart();
  }
  if (!$('#lock').hidden && !e.target.closest('input, textarea')) { signIn(); return; }
  const bootEl = $('#boot');
  if (!bootEl.hidden && (e.key === 'Enter' || e.key === ' ') && !e.target.closest('input, textarea')) {
    if (bootEl.classList.contains('intro-mode')) { save.intro = true; persist(); showBootLog(); e.preventDefault(); }
    else if (bootEl.dataset.done) { startLoop(); e.preventDefault(); }
    else if (bootEl.skip) { bootEl.skip(); e.preventDefault(); }
  }
});

// 소리 켜고 끄기
function toggleSound() {
  save.sound = !save.sound;
  persist();
  Sound.init();
  Sound.setOn(save.sound);
  renderSoundBtn();
}

function renderSoundBtn() {
  const b = $('#btn-sound');
  b.classList.toggle('off', !save.sound);
  b.setAttribute('aria-pressed', String(save.sound));
  b.title = save.sound ? '소리 끄기' : '소리 켜기';
}

// 잠금 화면: 클릭하면 로그인
$('#lock').addEventListener('click', signIn);

// 제목 표시줄 더블클릭: 최대화
document.addEventListener('dblclick', e => {
  const bar = e.target.closest('.titlebar');
  if (!bar || e.target.closest('button')) return;
  const w = winOf(bar);
  if (w && !APPS[w.app].dialog) w.el.classList.toggle('max');
});

// 브라우저는 사용자가 한 번 누른 뒤에야 소리를 허락함
document.addEventListener('pointerdown', () => Sound.init());
document.addEventListener('keydown', () => Sound.init());

addEventListener('resize', fit);
document.addEventListener('visibilitychange', () => { lastFrame = performance.now(); });

// 시작
fit();
renderSoundBtn();
buildCity();
initRain();
boot();
requestAnimationFrame(t => { lastFrame = t; frame(t); });
