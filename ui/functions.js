function GetMessages(callback) {
    var xhr = new XMLHttpRequest()
    var url = '/fn/Messages/GetMessages'
    xhr.open('POST', url, true)
    xhr.setRequestHeader('Content-type', 'application/json')
    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4 && xhr.status === 200) {
            callback(xhr.responseText)
        }
    }
    xhr.send()
}

function MessageCreate(entry) {
    var xhr = new XMLHttpRequest()
    var url = '/fn/Messages/MessageCreate'
    xhr.open('POST', url, true)
    xhr.setRequestHeader('Content-type', 'application/json')
    var data = JSON.stringify(entry)
    xhr.send(data)
}