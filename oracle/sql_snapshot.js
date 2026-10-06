module.exports = {
    selectLoginEmps : `
        SELECT 아이디, 이름, 관리자여부, 직위코드, 직위, 비밀번호
        FROM EMP_POS
    `,
    selectCodeNames : `
        SELECT DISTINCT 코드구분
        FROM CODE
        WHERE 사용여부 = 'Y'
    `,
    selectLeaveCntYears : `
        SELECT DISTINCT TO_CHAR(연도) 연도
        FROM LEAVE_CNT
    `,
    selectLeaveUserYears : `
        SELECT DISTINCT L.아이디, SUBSTR(LD.휴가일, 0, 4) 연도
        FROM LEAVE_SUMMARY L, LEAVE_DETAIL LD
        WHERE L.IDX = LD.LEAVE_IDX
    `,
    selectRewardUserYears : `
        SELECT DISTINCT 아이디, TO_CHAR(기준연도) 연도
        FROM REWARD
    `,
    selectHolidayYears : `
        SELECT DISTINCT SUBSTR(날짜, 0, 4) 연도
        FROM HOLIDAY
    `,
}
