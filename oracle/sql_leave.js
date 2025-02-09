module.exports = {
    selectLeaveInfo : (id) => {
        return `
            SELECT
                DISTINCT L.IDX,                
                ${!id ? "E.이름, E.이름 || ' ' || E.직위 || ' ' || L.내용" : "L.내용"} AS 내용,
                L.시작일,
                L.종료일,
                L.휴가일수,
                LD.휴가구분,
                LD.기타휴가내용,
                L.REWARD_IDX,
                C.코드명 AS 휴가순위
            FROM 
                LEAVE_SUMMARY L,
                LEAVE_DETAIL LD
                    LEFT JOIN (
                    SELECT 코드명, 표시내용
                    FROM CODE
                    WHERE 
                        코드구분 = '휴가순위'
                        AND 사용여부 = 'Y'
                ) C ON C.표시내용 = LD.휴가구분 
                ${!id ? ", EMP_POS E" : ""}
            WHERE
                ${!id ? "L.아이디 = E.아이디" : "아이디 = :id"}
                AND L.IDX = LD.LEAVE_IDX
                AND L.시작일 >= TO_CHAR(ADD_MONTHS(SYSDATE, -12), 'YYYY') || '-01-01'
                AND LD.휴가일 >= TO_CHAR(ADD_MONTHS(SYSDATE, -12), 'YYYY') || '-01-01'
            ORDER BY L.시작일${!id ? ", 휴가순위, E.이름" : ""}
        `
    },
    selectUseLeaveInfo : `
        SELECT
            LD.IDX,
            LD.휴가일 || ' (' || TO_CHAR(TO_DATE(LD.휴가일, 'YYYY-MM-DD'), 'DY','NLS_DATE_LANGUAGE=KOREAN') || ')' 휴가일,
            LD.휴가구분,
            LD.기타휴가내용,
            E.아이디,
            SUBSTR(LD.휴가일, 0, 4) 연도,
            DECODE(SUBSTR(휴가구분, 0, 2), '오후', 0.5, '오전', 0.5, '기타', 0, 1) 휴가일수
        FROM LEAVE_DETAIL LD, LEAVE_SUMMARY L, EMP E
        WHERE 
            LD.LEAVE_IDX = L.IDX
            AND E.아이디 = L.아이디
            AND E.아이디 = :id 
            AND SUBSTR(LD.휴가일, 0, 4) = :year
        ORDER BY 휴가일
    `,
    selectLeaveCnts : `
        SELECT DISTINCT(A.연도), A.아이디, NVL(LC.휴가수, 0) 휴가수, NVL(사용휴가수, 0) 사용휴가수
        FROM (
            SELECT 연도,아이디 FROM LEAVE_CNT WHERE 아이디 = :id
            UNION ALL
            SELECT SUBSTR(휴가일, 0, 4) 연도, 아이디
            FROM LEAVE_SUMMARY L, LEAVE_DETAIL LD
            WHERE 
                L.IDX = LD.LEAVE_IDX 
                AND L.아이디 = :id
            GROUP BY SUBSTR(휴가일, 0, 4), 아이디
        ) A
        LEFT JOIN (
            SELECT
                아이디,
                SUBSTR(휴가일, 0, 4) 연도,
                SUM(DECODE(SUBSTR(휴가구분, 0, 2), '오후', 0.5, '오전', 0.5, '기타', 0, '포상', 0, '리프', 0, 1)) 사용휴가수
            FROM LEAVE_SUMMARY L, LEAVE_DETAIL LD
            WHERE 
                L.IDX = LD.LEAVE_IDX 
                AND L.아이디 = :id
            GROUP BY SUBSTR(휴가일, 0, 4), 아이디
        ) L ON A.연도 = L.연도
        LEFT JOIN (
            SELECT
                아이디,
                연도,
                휴가수
            FROM LEAVE_CNT
            WHERE 아이디 = :id
        ) LC ON A.연도 = LC.연도
    `,
    selectLeaveHistory : `
        SELECT A.*
        FROM (
            SELECT H.IDX, E.이름, E.아이디, H.내용, TO_CHAR(H.등록일자, 'YYYY-MM-DD HH24:MI:SS') 등록일자
            FROM HISTORY H, EMP E
            WHERE H.아이디 = E.아이디
            ORDER BY 등록일자 DESC, 내용 DESC
        ) A
        WHERE ROWNUM < 31
    `,
    updateLeaveCnt : `
        MERGE INTO LEAVE_CNT
        USING DUAL
        ON (
            아이디 = :아이디
            AND 연도 = :기준연도
        )
        WHEN MATCHED THEN
            UPDATE SET 휴가수 = :휴가수 + 이월휴가수, 수정일자 = SYSDATE
        WHEN NOT MATCHED THEN
            INSERT (아이디, 연도, 휴가수)
            VALUES (:아이디, :기준연도, :휴가수)
    `,
    selectSeq : "SELECT SEQ_LEAVE.NEXTVAL SEQ FROM DUAL",
    insertLeave : `
        INSERT INTO LEAVE_SUMMARY
        (IDX, 내용, 시작일, 종료일, 휴가일수, 아이디, REWARD_IDX)
        VALUES
        (:seq, :name, :startDate, :endDate, :cnt, :id, :updateReward)
    `,
    insertLeaveDetail : `
        INSERT INTO LEAVE_DETAIL
        (IDX, LEAVE_IDX, 휴가일, 휴가구분, 기타휴가내용)
        VALUES
        (SEQ_LEAVE_DETAIL.NEXTVAL, :seq, :ymd, :type, :etcType)
    `,
    deleteLeave : `DELETE FROM LEAVE_SUMMARY WHERE IDX = :idx`,
    deleteLeaveDetail : `DELETE FROM LEAVE_DETAIL WHERE LEAVE_IDX = :idx`,
    insertHistory : `
        INSERT INTO HISTORY (IDX, 아이디, 내용)
        VALUES (SEQ_HISTORY.NEXTVAL, :id, :name)
    `,
    carryOverLeave : (isAllCarry) => {
        return `
            MERGE INTO LEAVE_CNT LT 
            USING (
                SELECT 아이디, 휴가수 - SUM(사용휴가수) AS 남은휴가수
                FROM (
                    SELECT 
                        LC.아이디,
                        LC.휴가수, 
                        LD.휴가일, 
                        DECODE(LD.휴가구분, '휴가', 1, '오전 반차', 0.5, '오후 반차', 0.5, 0) AS 사용휴가수
                    FROM LEAVE_CNT LC
                        LEFT JOIN (
                            SELECT 
                                LS.아이디,
                                LD.휴가일,
                                LD.휴가구분
                            FROM 
                                LEAVE_SUMMARY LS, 
                                LEAVE_DETAIL LD
                            WHERE 
                                LS.IDX = LD.LEAVE_IDX 
                                AND LD.휴가일 BETWEEN ':lastYear' AND ':thisYear'
                        ) LD ON LC.아이디 = LD.아이디
                    WHERE LC.연도 = ':lastYear'
                )
                GROUP BY 아이디, 휴가수
                ${isAllCarry ? "" : "HAVING 휴가수 - SUM(사용휴가수) < 0"}
            ) LL ON (
                LT.아이디 = LL.아이디
                AND LT.연도 = ':thisYear'
            )
            WHEN MATCHED THEN
                UPDATE SET
                    이월휴가수 = LL.남은휴가수,
                    휴가수 = LT.휴가수 - LT.이월휴가수 + LL.남은휴가수,
                    수정일자 = SYSDATE
            WHEN NOT MATCHED THEN
                INSERT (
                    아이디,
                    연도,
                    휴가수,
                    이월휴가수		
                ) VALUES (
                    LL.아이디,
                    ':thisYear',
                    LL.남은휴가수,
                    LL.남은휴가수
                )            
        `
    }
}