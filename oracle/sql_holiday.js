module.exports = {
    selectHolidays : `
        SELECT 
            명칭,
            수동여부,
            TO_CHAR(TO_DATE(MIN(날짜), 'YYYYMMDD'), 'YYYY-MM-DD') 시작일,
            TO_CHAR(TO_DATE(MAX(날짜), 'YYYYMMDD'), 'YYYY-MM-DD') 종료일
        FROM HOLIDAY
        WHERE 날짜 LIKE :year || '%'
        GROUP BY 명칭, 수동여부
        ORDER BY 시작일
    `,
    selectDetailHolidays : `
        SELECT 명칭, 날짜
        FROM HOLIDAY
        WHERE 날짜 > TO_CHAR(ADD_MONTHS(SYSDATE, -12), 'YYYY')
        ORDER BY 날짜		
    `,
    updateHoliday : `
        MERGE INTO HOLIDAY
        USING DUAL ON (
            날짜 = :locdate
        )
        WHEN MATCHED THEN
            UPDATE SET 
                명칭 = :dateName,
                수정일자 = SYSDATE,
                수동여부 = :manualYN
        WHEN NOT MATCHED THEN
            INSERT (명칭, 날짜, 수동여부)
            VALUES (:dateName, :locdate, :manualYN)
    `,
    deleteHoliday : `
        DELETE FROM HOLIDAY
        WHERE
            명칭 = :name
            AND 날짜 LIKE :year || '%'
    `

}