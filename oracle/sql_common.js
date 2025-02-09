selectCommonCode = 

module.exports = {
    selectEmpInfo : `
        SELECT 아이디, 이름, 관리자여부, 직위코드, 직위
        FROM EMP_POS E
        WHERE 아이디 = :id AND 비밀번호 = :pw
    `,
    selectEmpBirthday : `
        SELECT 
            이름 || ' ' || DECODE(관리자여부, 'N', 직위, '') 이름,
            생일,
            음력여부
        FROM EMP_POS
        WHERE 생일 IS NOT NULL
    `,
    selectEmpEmail : `
        SELECT E.아이디 || '@' || C.표시내용 이메일
        FROM EMP E, (
            SELECT 표시내용 
            FROM CODE 
            WHERE 
                사용여부 = 'Y' 
                AND 코드구분 = '이메일' 
                AND 코드명 = 0
        ) C
        WHERE 
            E.아이디 = :id
            AND E.이름 = :name
    `,
    selectCommonCode : (sort) => {
        return `
            SELECT 코드명, 표시내용 
            FROM CODE
            WHERE 코드구분 = :name AND 사용여부 = 'Y' 
            ORDER BY 코드명 ${sort}
        `
    },
    updatePassword : `
        UPDATE EMP 
        SET 비밀번호 = :pw 
        WHERE 아이디 = :id
    `,
}