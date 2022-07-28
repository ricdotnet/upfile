const formData = `POST /hello HTTP/1.1
Host: localhost:3001
User-Agent: insomnia/2022.4.2
Content-Type: multipart/form-data; boundary=X-INSOMNIA-BOUNDARY
Accept: */*
Content-Length: 103

--X-INSOMNIA-BOUNDARY
Content-Disposition: form-data; name="field"

value
--X-INSOMNIA-BOUNDARY
Content-Disposition: form-data; name="filefield"; filename="index.html"
Content-Type: text/html

<!DOCTYPE html>
<html lang="en" dir="ltr">
  <head>
    <meta charset="utf-8">
    <title>Welcome to projects.rrocha.uk</title>
  </head>
  <body>
    <h1>Success! projects.rrocha.uk home page!</h1>
  </body>
</html>

--X-INSOMNIA-BOUNDARY--`;

export {
  formData
};
