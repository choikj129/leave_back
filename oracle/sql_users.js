module.exports = {
    selectUsersInfo : (whereId) => {
        return `
            SELECT
                E.아이디, E.이름, E.직위코드, E.직위, E.입사일, E.관리자여부, E.생일, E.음력여부,
                :year 연도, 
                LC.휴가수, 
                LC.이월휴가수,
                NVL(LD.사용휴가수, 0) 사용휴가수,
                NVL(LD.기타휴가수, 0) 기타휴가수,
                NVL(RF.리프레시휴가수, 0) 리프레시휴가수,
                NVL(RF.사용리프레시휴가수, 0) 사용리프레시휴가수,
                NVL(RR.포상휴가수, 0) 포상휴가수,
                NVL(RR.사용포상휴가수, 0) 사용포상휴가수,
                NVL(RF.리프레시휴가수, 0) + NVL(RR.포상휴가수, 0) 추가휴가수,
                NVL(RR.사용포상휴가수, 0) + NVL(RF.사용리프레시휴가수, 0) 사용추가휴가수,
                TRUNC(MONTHS_BETWEEN(SYSDATE, TO_DATE(입사일, 'YYYYMMDD'))/12) + 1 || '년차' 입사년차
            FROM EMP_POS E
                LEFT JOIN (
                    SELECT 
                        아이디,
                        연도,
                        휴가수,
                        이월휴가수
                    FROM LEAVE_CNT
                    WHERE 연도 = :year
                ) LC ON E.아이디 = LC.아이디
                LEFT JOIN (
                    SELECT
                        아이디,
                        SUBSTR(휴가일, 0, 4) 연도,
                        SUM(CASE 
                            WHEN 휴가구분 IN ('오전 반차', '오후 반차') THEN 0.5
                            WHEN 휴가구분 IN ('기타 휴가', '포상 휴가', '리프레시 휴가') THEN 0
                            ELSE 1
                        END) 사용휴가수,
                        SUM(DECODE(SUBSTR(휴가구분, 0, 2), '기타', 1, 0)) 기타휴가수
                    FROM LEAVE_SUMMARY L, LEAVE_DETAIL LD
                    WHERE 
                        L.IDX = LD.LEAVE_IDX
                        AND SUBSTR(휴가일, 0, 4) = :year
                    GROUP BY SUBSTR(휴가일, 0, 4), 아이디
                ) LD ON LD.아이디 = E.아이디
                LEFT JOIN (
                    SELECT
                        아이디,
                        SUM(휴가일수) 리프레시휴가수,
                        SUM(사용일수) 사용리프레시휴가수
                    FROM REWARD
                    WHERE
                        휴가유형 = '리프레시'
                        AND 기준연도 = :year
                    GROUP BY 아이디
                ) RF ON E.아이디 = RF.아이디
                LEFT JOIN (
                    SELECT
                        아이디,
                        SUM(휴가일수) 포상휴가수,
                        SUM(사용일수) 사용포상휴가수
                    FROM REWARD
                    WHERE
                        휴가유형 = '포상'
                        AND 기준연도 = :year
                    GROUP BY 아이디
                ) RR ON E.아이디 = RR.아이디
            WHERE 직위코드 != 'Z'
                ${whereId}
            ORDER BY 
                직위코드,
                입사일,
                이름
        `
    },
    updateUserInfo : `
        UPDATE EMP 
        SET 
            직위코드 = :position,
            입사일 = :joinDate,
            생일 = :birthday,
            음력여부 = :isLunar,
            수정일자 = SYSDATE
        WHERE 아이디 = :id
    `,
    insertUser : `
        MERGE INTO EMP 
        USING DUAL ON (
            아이디 = :id
        )
        WHEN NOT MATCHED THEN
            INSERT (아이디, 이름, 직위코드, 입사일, 생일, 음력여부)
            VALUES (:id, :name, :position, :joinDate, :birthday, :isLunar)
    `,
    deleteUser : `DELETE FROM EMP WHERE 아이디 = :id`,
}