let axios = require("axios")
let apiKey = require("./config/apiKey");

axios.default.post["Content-Type"] = "application/json"
axios.defaults.baseURL = "https://api.kakaowork.com/v1"
axios.defaults.headers.common["Authorization"] = apiKey

getUserId = (email) => {
    return axios.get(`/users.find_by_email?email=${email}`)
        .then((res) => {
            if (!res.data.success) {
                return false
            }            
            return res.data.user.id            
        })
}

conversationOpen = (id) => {
    return axios.post("/conversations.open", {
        "user_id" : id
    }).then((res) => {     
        if (!res.data.success) {
            return false
        }
        return res.data.conversation.id
    })
}

sendKW = (id, text) => {
    return axios.post("/messages.send", {
        "conversation_id" : id,
        "text" : text
    }).then((res) => {
        if (!res.data.success) {
            return false
        }
        return true
    })
}

module.exports = {
    sendMessage : function(contents, user, callback) {
        /* 
            개발자 1:1 채팅방 ID : 5232329 
            단체 채팅방 ID       : 5385099
        */
        const conId = 5232329
        const text = `${user.name} [${user.id}]\n${contents.join("\n")}`
        sendKW(conId, text).then((succ) => {
            callback(succ)
        })
    },
}