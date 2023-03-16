# 개발 정보
 - node version : 16.17.0
 - npm version : 9.2.0

# npm script
 - 기동 : npm run start

# Back 초기 설정
 ### exports/config 디렉터리는 보안 상 이슈로 ignore 되어있어 aws server에서 가져와야함.
 - apiKey.js : 동일
 - clientPath.js :  oracledb를 사용하기 위해 instantclient_21_8 디렉터리가 필요 <br>
  (해당 디렉터리는 NAS/설치파일/instantclient_*.zip 파일을 받고<br> 디렉터리 경로를 clientPath.js에 맞춰주면 됨)
 - crypto.js : 동일
 - db_connect.js : 로컬에서 개발할 때 **반드시 개발 DB로 바꿔서 개발해야함**
 - conversation_id.js : 로컬에서 개발할 때 **반드시 ID를 단체 채팅방 ID (TEST)로 바꿔서 개발해야함**