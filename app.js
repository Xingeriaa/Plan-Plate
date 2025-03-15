
const path = require('path');
const express = require('express');
const app = express();
const port = 3000;

app.use(express.static('public'));

app.get('/', (req, res) => {
  res.status(200).set('Content-type', 'text/html');
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
})

app.listen(port, (error) => {
  if (error) {
    console.log(`Something went wrong!`, error);
  } else {
    console.log(`Example app listening on port ${port}`);
  }
})
  

