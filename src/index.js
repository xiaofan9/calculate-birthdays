const lodash = require("lodash");
const lunarMapping = require("./lunar-mapping.js");

// 计算农历
const getLunarCalendar = (function() {
  // 查找农历
  function findLunar(solar, index, minMonth, maxMonth, isPreYear) {
    //取得映射的数据
    const mapping = lunarMapping[index];
    if (!mapping) return false;

    let year = solar.getFullYear();
    const month = solar.getMonth() + 1,
      date = solar.getDate();
    let lunarYear = year;
    let lunarMonth, find, solarMonth, segMonth, segDay;

    //查找农历
    for (let i = mapping.length - 1; i > 0; i--) {
      lunarMonth = i;
      //取对应的农历月与天
      segMonth = Number(mapping[i].substring(0, 2));
      segDay = Number(mapping[i].substring(2, 4));

      solarMonth = isPreYear && segMonth > 12 ? segMonth - 12 : segMonth;
      find =
        solarMonth < month ||
        (solarMonth == month && segDay <= date) ||
        ((segMonth <= minMonth || segMonth >= maxMonth) && isPreYear);
      if (solarMonth == 12 && solarMonth > month && i == 1) {
        find = true;
        year--;
      }
      if (find) break;
    }

    //如果找到，则赋值
    if (!find) return false;
    //取前一年
    if (isPreYear && segMonth == 12) year = year - 1;
    lunarYear = isPreYear ? lunarYear - 1 : lunarYear;

    return {
      year: year,
      month: solarMonth,
      day: segDay,
      lunarYear: lunarYear,
      lunarMonth: lunarMonth,
      leapMonth: mapping[0] //闰月
    };
  }

  //计算公历两个日期之差
  function solarDayDiff(left, right) {
    return parseInt(parseInt(left.getTime() - right.getTime()) / (1000 * 60 * 60 * 24));
  }

  const minYEAR = 1900;

  // 公历转农历
  return function(solar) {
    const offset = solar.getFullYear() - minYEAR;
    // 超出范围
    if (offset <= 0 || offset >= lunarMapping.length) {
      throw new Error("Specified date range is invalid.");
    }

    //查找范围内的农历数据
    let data = findLunar(solar, offset, 0, 13, false);
    //如果没有找到，则找前一年的，因为农历在公历之前，并且不会超过一年，查一年就可以了
    data = data || findLunar(solar, offset - 1, 12, 99, true);

    //还是没有找到，表示超出范围
    if (!data) return false;

    //农历初一对应公历的哪一天
    const firstDay = new Date(data.year, data.month - 1, data.day);
    const day = solarDayDiff(solar, firstDay) + 1;

    //返回的农历结果
    const result = {
      leap: data.leapMonth > 0 && data.leapMonth + 1 == data.lunarMonth,
      year: data.lunarYear,
      month:
        data.leapMonth > 0 && data.lunarMonth > data.leapMonth
          ? data.lunarMonth - 1
          : data.lunarMonth,
      day: day,
      leapMonth: data.leapMonth
    };

    return result;
  };
})();

// 算出一年内，所有节气的公历日期，有误差
function getYearSolarTermList(y) {
  const yearSolarTermList = [];
  const sTermInfo = [
    0,
    21208,
    42467,
    63836,
    85337,
    107014,
    128867,
    150921,
    173149,
    195551,
    218072,
    240693,
    263343,
    285989,
    308563,
    331033,
    353350,
    375494,
    397447,
    419210,
    440795,
    462224,
    483532,
    504758
  ]; // 节气数组

  for (let i = 0; i <= 23; i++) {
    yearSolarTermList.push(
      new Date(31556925974.7 * (y - 1900) + sTermInfo[i] * 60000 + Date.UTC(1900, 0, 6, 2, 5))
    );
  }

  return yearSolarTermList;
}

// 计算节令月
function getFestiveMonth(date, lunarCalendar) {
  const yearSolarTermList = getYearSolarTermList(date.getFullYear());

  const m = date.getMonth();
  const d = date.getDate();

  const nowFestival = []; //当月节日

  for (let i = 0; i < yearSolarTermList.length; i++) {
    if (yearSolarTermList[i].getMonth() == m) {
      nowFestival.push(yearSolarTermList[i]);
    }
  }

  let nowMonthDivideDay,
    tempLunar = 0;

  for (let j = 0; j < nowFestival.length; j++) {
    const lunar = getLunarCalendar(nowFestival[j]).day;

    if (lunar > tempLunar) {
      tempLunar = lunar;

      nowMonthDivideDay = nowFestival[j].getDate();
    }
  }

  let festiveMonth = lunarCalendar.month;

  if (nowMonthDivideDay <= d && !lunarCalendar.leap) {
    // 判断 当前的月的 以节气为分界的分界天（公历 是否小于 当前天（公历，如果刚好在农历是润月，则不变，否则加一
    festiveMonth += 1;
  }

  return festiveMonth;
}

function addZero(str) {
  return String(str).length === 1 ? "0" + str : str;
}

// 根据传入的日期计算生辰八字
function calculateBirthdays(date) {
  const gan = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
  const zhi = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];

  if (!lodash.isDate(date)) {
    date = new Date(date);
  }

  // 根据公历日期 ,计算年天干
  function getYearGZ(date) {
    const lunarCalendar = getLunarCalendar(date); // 拿到农历

    const y = lunarCalendar.year;

    const g = gan[(y - 4) % 10]; // 以庚年为序数0
    const z = zhi[(y - 4) % 12]; // 以申年为序数0

    return g + z;
  }

  // 月天干地支，以节气来分划分月份，1月 立春始 ， 2月 惊蛰始 ，3月 清明始 以此类推 这里的月份是农历，即节令月。

  // 月天干算法（地支不变
  // 若遇甲或己的年份，正月大致是丙寅；
  // 遇上乙或庚之年，正月大致为戊寅；
  // 丙或辛之年正月大致为庚寅，
  // 丁或壬之年正月大致为壬寅，
  // 戊或癸之年正月大致为甲寅
  function getMonthGZ(date) {
    const lunarCalendar = getLunarCalendar(date); // 拿到农历
    const month = getFestiveMonth(date, lunarCalendar); // 拿到节令月
    const yearGZ = getYearGZ(date).substring(0, 1); // 拿到农历年天干

    let n; // 起始序数
    if ("戊癸".indexOf(yearGZ) >= 0) {
      n = 0;
    } else if ("甲己".indexOf(yearGZ) >= 0) {
      n = 2;
    } else if ("乙庚".indexOf(yearGZ) >= 0) {
      n = 4;
    } else if ("丙辛".indexOf(yearGZ) >= 0) {
      n = 6;
    } else if ("丁壬".indexOf(yearGZ) >= 0) {
      n = 8;
    }

    const g = gan[(n + month - 1) % 10];
    const z = zhi[(1 + month) % 12];

    return g + z;
  }

  // 日的天干算法
  // 乘五除四九加日，
  // 双月间隔三十天。
  // 一二自加整少一，
  // 三五七八十尾前。
  // 具体参看 ：http://blog.sina.com.cn/s/blog_7e69a9bf0102vv1m.html
  function getDayGZ(date) {
    const ms = [0, 0, 0, 1, 1, 2, 2, 3, 4, 4, 5, 5]; // 12个月 每个月前的大月数（就是月份天数大于30天
    const base = 1900;
    const y = date.getFullYear();
    const d = date.getDate();
    const m = date.getMonth();
    const k = 9;
    const f = (m + 1) % 2 === 0 ? 30 : 0;
    const Y = y - base;

    const gz = [];

    for (let i = 0; i < 60; i++) {
      gz.push(gan[i % 10] + zhi[i % 12]);
    }

    const r = (Y * 5 + Math.floor(Y / 4) + k + d + ms[m] + f) % 60;

    return gz[r - 1];
  }

  // 甲己起甲子：甲日、己日夜半的子时起于甲子时，顺推乙丑等。
  // 乙庚起丙子：乙日、庚日夜半的子时起于丙子时，顺推乙丑等。
  // 丙辛起戊子：丙日、辛日夜半的子时起于戊子时，顺推乙丑等。
  // 丁壬起庚子：丁日、壬日夜半的子时起于庚子时，顺推乙丑等。
  // 戊癸起壬子：戊日、癸日夜半的子时起于壬子时，顺推乙丑等。
  function getHourGZ(date) {
    if (!date) {
      return new Error("请输入必要的参数！");
    }

    const dayGZ = getDayGZ(date).substring(0, 1);
    const h = date.getHours();

    let n; // 起始序数
    if ("甲己".indexOf(dayGZ) >= 0) {
      n = 0;
    } else if ("乙庚".indexOf(dayGZ) >= 0) {
      n = 2;
    } else if ("丙辛".indexOf(dayGZ) >= 0) {
      n = 4;
    } else if ("丁壬".indexOf(dayGZ) >= 0) {
      n = 6;
    } else if ("戊癸".indexOf(dayGZ) >= 0) {
      n = 8;
    }

    const g = gan[(Math.ceil(h / 2) + n) % 10];
    const z = zhi[Math.ceil(h / 2) % 12];

    return g + z;
  }

  return (
    date.getFullYear() +
    "年" +
    addZero(date.getMonth() + 1) +
    "月" +
    addZero(date.getDate()) +
    "日" +
    date.getHours() +
    "时 => " +
    (getYearGZ(date) + "年" + getMonthGZ(date) + "月" + getDayGZ(date) + "日" + getHourGZ(date) + "时")
  );
}

exports.getFestiveMonth = getFestiveMonth;
exports.getYearSolarTermList = getYearSolarTermList;
exports.getLunarCalendar = getLunarCalendar;
exports.calculateBirthdays = calculateBirthdays;
