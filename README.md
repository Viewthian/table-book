I would like to develop web application using nodejs on both side(fronend and backend).

Node JS Support
- Non blocking I/O (Asynchonous) -> run 1st request in background without waiting the 1st request to be finished. So, it can be able to continue process a next request.
- Module processing design, the application will run only the related module only. So, it will be more faster in processing.

Installation
1.go to nodejs.org/en 
2.download and install nodejs
3.verify installation, cmd >> 'node -v'
4.go to repo -> terminal, then cmd >> 'npm init' to activate json package in order to use in this application
5.input required fields about the application. After finish you will get the package.json file
  **alternative way >> npm init -y , this will automatically generate app info and you can give meaningfull value later
6.create server site
7.install nodemon >> npm install nodemon , this module use for tracking changes on server site and it will be automatically restart server. 
  Without it, we have to restart by ourselves
8.In package.json file, add "start": "nodemon ./bin/www" under parameter 'scripts' in order to use command 'npm start' to start server
9.install node express
10.install mongodb
11.install mongoose (npm install mongoose) + connect mongoose
12.


