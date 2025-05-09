module.exports = {
    selectEmpReward : `
        SELECT R.*, E.이름, E.직위
        FROM REWARD R, EMP_POS E
        WHERE
            R.아이디 = E.아이디
            AND E.아이디 = :id
            AND R.기준연도 = :year
        ORDER BY 등록일
    `,
    selectReward : (type) => {
        return `
            SELECT *
            FROM REWARD
            WHERE
                아이디 = :id
                AND 휴가일수 > 사용일수
                AND 휴가유형 = '${type}'
                AND 기준연도 = :year
            ORDER BY 만료일, IDX
        `
    },
    selectRewardCnt : (type) => {
        return `
            SELECT NVL(휴가일수, 0) 휴가일수, NVL(사용일수, 0) 사용일수, 만료일
            FROM REWARD
            WHERE
                아이디 = :id
                AND 기준연도 = :year
                AND 휴가유형 = '${type}'
        `
    },
    insertReward : `
        INSERT INTO REWARD (
            IDX, 아이디, 휴가유형, 휴가일수, 등록일, 만료일, 기준연도
        ) VALUES (
            SEQ_REWARD.NEXTVAL, :id, :type, :cnt, :date, :expireDate, :year
        )
    `,
    updateReward : `
        UPDATE REWARD 
        SET
            휴가일수 = :cnt,
            만료일 = :expireDate
        WHERE IDX = :idx
    `,
    updateRewardFromExcel : `
        MERGE INTO REWARD
        USING DUAL
        ON (
            아이디 = :아이디
            AND 기준연도 = :기준연도
            AND 휴가유형 = :휴가유형
            AND 등록일 = :등록일
            AND 만료일 = :만료일
        )
        WHEN MATCHED THEN
            UPDATE SET 
                휴가일수 = :휴가수,
                등록일자 = SYSDATE
        WHEN NOT MATCHED THEN
            INSERT (아이디, 기준연도, 휴가유형, 등록일, 만료일, 휴가일수)
            VALUES (:아이디, :기준연도, :휴가유형, :등록일, :만료일, :휴가수)
    `,
    useReward : `UPDATE REWARD SET 사용일수 = :사용일수 WHERE IDX = :IDX AND 사용일수 != :사용일수`,
    cancleReward : `UPDATE REWARD SET 사용일수 = 사용일수 - :cnt WHERE IDX = :idx`,
    deleteReward : `
        DELETE FROM REWARD 
        WHERE 
            IDX = :idx 
            AND 사용일수 = 0
    `,
    carryOverRewrad : (year) => {
        return `
			INSERT INTO REWARD (
				IDX, 아이디, 휴가유형, 휴가일수, 등록일, 만료일, 사용일수, 기준연도, ROOT_IDX
			)
			SELECT SEQ_REWARD.NEXTVAL, 아이디, 휴가유형, 휴가일수 - 사용일수, 등록일, 만료일, 0, ${year}, IDX
			FROM REWARD
			WHERE 
				기준연도 = TO_CHAR(${year - 1})
				AND 휴가일수 > 사용일수
				AND 만료일 >= ${year} || '0101'
		`
    },

}