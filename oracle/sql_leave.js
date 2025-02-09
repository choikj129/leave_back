module.exports = {
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
    `
}