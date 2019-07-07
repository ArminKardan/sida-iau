const puppeteer = require('puppeteer');
const fs  = require('fs');

class IAUFetcher {

  constructor()
  {
    this.SessionPool = [];
    setInterval(()=>{
      this.SessionPool.forEach((item)=>{
        var now  = new Date().getTime();
        if((now - item.lastupdate) > 1000*60*18) //refresh pool every 30 sec and remove sessions more than 18 minutes idle
        {
          item=null;
        }
      })
    }, 30000);
  }
  importToSessionPool(username, sessionid , specs)
  {
    var lastupdate = new Date().getTime();
    this.SessionPool.push({username,sessionid,lastupdate, specs});
  }
  async getSession(username, password)
  {
    let user = this.SessionPool.filter((item)=>
    {
      return item.username == username;
    })

    if(user.length > 0)
    {
      var lu = Number(user[0].lastupdate);
      var now = new Date();
      if(now - lu > 20*60*1000)
      {
        return await this.login(username, password);
      }
      else
      {
        user[0].lastupdate = new Date().getTime(); //session fetched and updated in remote server
      }

      return user[0].sessionid;
    }
    else
    {
      return await this.login(username, password);
    }
  }
  async init()
  {
    this.browser = await puppeteer.launch({headless: true});
  }
  async login(username, password) {

    //check if it's in session pool!
    let user = this.SessionPool.filter((item)=>{
      return item.username == username;
    })
    if(user.length > 0)
    {
      return user;
    }


    this.page = await this.browser.newPage();

    //Image ignorance
    await this.page.setRequestInterception(true);
    this.page.on('request', request => {
      let res = request.resourceType();
      if ((res == 'image')||(res=='media')||(res=='font')||(res=='manifest')||(res=='other')||(res=='stylesheet'))
        request.abort();
      else
        request.continue();
    });

    await this.page.goto('http://sida1.iaushiraz.ac.ir/loginb.aspx');
    await this.page.type('#txtUserName', username);
    await this.page.type('#txtPassword', password);
    await this.page.click('#btn_ent_stu');
    await this.page.waitForNavigation();

    const bodyHandle = await this.page.waitForSelector("html")
    
    let specs = await this.page.evaluate(body => 
    {
      let specs = {};
       specs["fullname"] = document.querySelector("#ContentPlaceHolder1_infoUser_lblFullName").innerText;
       specs["date"] = document.querySelector("#ContentPlaceHolder1_infoUser_lblDate").innerText;
       specs["father"] = document.querySelector("#ContentPlaceHolder1_infoUser_lblStFatherName").innerText;
       specs["current_term"] = document.querySelector("#ContentPlaceHolder1_infoUser_lblCurrentTerm").innerText;
       specs["stud_code"] = document.querySelector("#ContentPlaceHolder1_infoUser_lblStcode").innerText;
       specs["study_field"] = document.querySelector("#ContentPlaceHolder1_infoUser_lblStBarnchName").innerText;
       specs["edu_level"] = document.querySelector("#ContentPlaceHolder1_infoUser_lblStEduLevel").innerText;
       specs["edu_system"] = document.querySelector("#ContentPlaceHolder1_infoUser_lblStEduSystem").innerText;
       specs["payment_id"] = document.querySelector("#ContentPlaceHolder1_infoUser_Lbljam_id").innerText;
      return specs;
    }, bodyHandle);

    await bodyHandle.dispose();

    var t = await this.page.cookies();
    var cookie = JSON.stringify(t);
    
    this.importToSessionPool(username, cookie , specs);
    //console.log(`Session ID is:`+JSON.stringify(t, 0 , 4));
    await this.page._client.send('Network.clearBrowserCookies')
    //var tx = await this.page.cookies();
    await this.page.close();
    return cookie;
  }
  removeSession(username)
  {
    this.SessionPool.forEach((item)=>{
      if(item == username)
      {
        item=null;
      }
    })
  }
  async getEterazNomre(username, password)
  {
    let sessionString = await this.getSession(username,password);
    this.page = await this.browser.newPage();
    let cook = JSON.parse(sessionString);
    this.page.setCookie(...cook);

    await this.page.goto('http://sida1.iaushiraz.ac.ir/eteraz_nomreh.aspx');
    await this.page.click('#ContentPlaceHolder1_TermList1_RadGrid2_2_lnkYear_0');
    await this.page.reload();
    const head = await this.page.waitForSelector("head");
    

    const bodyHandle = await this.page.waitForSelector("html")

    let result = await this.page.evaluate(body => 
    {
        if(document.querySelector("title").innerText.includes("ورود"))
        {
          console.log("Enterance needed!");
          removeSession(username);
          this.getEterazNomre(username,password);
        }
        var arr = [];
        document.querySelectorAll("table")[4]
        .querySelector("tbody")
        .querySelectorAll("tr").forEach((item)=>{
            //var y = item.innerText.replace(/\s\s+/g, ' ');
            var obj = {};

              var u = item.querySelector("td:nth-child(1)");
              if(u!=null && (isNaN(u.textContent.trim())==false) )
              {
                if(u.textContent.trim().length > 0)
                { 
                  obj["ID"] = Number(u.textContent);
                  obj["CourseID"] = item.querySelector("td:nth-child(2)").textContent.trim();
                  obj["CourseName"] = item.querySelector("td:nth-child(3)").textContent.trim();
                  obj["Professor"] = item.querySelector("td:nth-child(4)").textContent.trimLeft().trimRight();
                  obj["TheoryWeight"] = item.querySelector("td:nth-child(5)").textContent.trimLeft().trimRight();
                  obj["PracticalWeight"] = item.querySelector("td:nth-child(6)").textContent.trimLeft().trimRight();
                  obj["MainMark"] = item.querySelector("td:nth-child(7)").textContent.trimLeft().trimRight().replace("غــــــيبت","غیبت");
                  obj["TheoricalMark"] = item.querySelector("td:nth-child(8)").textContent.trimLeft().trimRight();
                  obj["PracticalMark"] = item.querySelector("td:nth-child(9)").textContent.trimLeft().trimRight();
                  arr.push(obj);
                }
              }
        })
        return arr
      }, bodyHandle);
      await bodyHandle.dispose();
      await this.page._client.send('Network.clearBrowserCookies')
      return result;

  }
  async getSpecs(username, password)
  {
    await this.getSession(username,password);
    var sess = this.SessionPool.filter((item)=>{
      return item.username == username;
    })
    return sess[0].specs;
  }

  async getKarname(username, password)
  {
    await this.getSession(username,password);
    var sess = this.SessionPool.filter((item)=>{
      return item.username == username;
    })
    return sess[0].specs;
  }
}


async function Test()
{
  var obj = new IAUFetcher();
  await obj.init(); //start browser
  let ranks = await obj.getEterazNomre("970002312", "2280893266");

  let spec = await obj.getSpecs("970002312", "2280893266");
  fs.writeFileSync("response.html",JSON.stringify(spec,0,4));
}


console.log('\033[2J'); //clear the terminal
Test().then(()=>{
  console.log("It's done!");
})

