import React,{ useState, useEffect } from 'react';

import JSBI from 'jsbi/dist/jsbi.mjs';

import { ChainId, Token, Fetcher, Trade, Route, TokenAmount, TradeType, Percent } from '@uniswap/sdk';

import Web3 from 'web3';
import Web3Modal from 'web3modal';
import WalletConnectProvider from "@walletconnect/web3-provider";
import {Button} from 'react-bootstrap';
import ABIS from './Abis/abis.json';


function App() {
  const [fromToken, setFromToken] = useState('ETH'); // sender token name
  const [toToken, setToToken] = useState('DAI');  // receiver token name
  const [receiveAddr, setReceiveAddr] = useState(''); // token receiver address
  const [fromAmount, setFromAmount] = useState(0); // sender token amount
  const [toAmount, setToAmount] = useState(0); // receiver token amount(estimate)
  const [walletConnected, setwalletConnected] = useState(false); // check the wallet connected to my website or not

  useEffect(() => {
    //check the metakmask connected
    if(Web3.givenProvider != null){
      setwalletConnected(true);
    }
  }, []);

  // erc20Tokens information json array
  const erc20Tokens = {
    "ETH": {
      "name": "WETH",
      "address": "0xc778417E063141139Fce010982780140Aa0cD5Ab",
      "decimals": 18
    },

    "DAI": {
        "name": "DAI",
        "address": "0xc7AD46e0b8a400Bb3C915120d284AafbA8fc4735",
        "decimals": 18,
    },

    "UNI": {
      "name": "UNI-V2",
      "address": "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
      "decimals": 18,
    },

    "MKR": {
      "name": "Maker",
      "address": "0xF9bA5210F91D0474bd1e1DcDAeC4C58E359AaD85",
      "decimals": 18,
    },
  };
  
  //tokenLists avaliable in Rinkeby network
  const tokenList = ['ETH', 'DAI', 'UNI', 'MKR'];
  const NETWORK = 'Rinkeby'; // Rinkeby test network
  const chainId = ChainId.RINKEBY; // Rinkeby test network chain id
  const UniSwapV2Addrs = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";

  // wallet connect provider options
  const providerOptions = {
    walletconnect: {
      package: WalletConnectProvider,
      options: {
        infuraId: "27e484dcd9e3efcfd25a83a78777cdf4" // Rinkeby network infuraid
      }
    }
  };

  //web3Modal connect to Metamask
  const web3Modal = new Web3Modal({
    network: NETWORK, // optional
    cacheProvider: true, // optional
    providerOptions // required
  });

  //connect metamask to current website
  async function connectWallet(){
    await window.ethereum.enable();
    await web3Modal.connect();
  }

  //swap token between two ERC20 tokens or ETH
  async function swapTokens(){
    var web3 = new Web3(Web3.givenProvider || 'ws://some.local-or-remote.node:8546'); // init web3 with default provider
    await window.ethereum.enable();

    // error handling in token receiver address input.
    if(receiveAddr === ''){
      alert("You should input receiver address!"); return;
    }

    let receiverAddress = '';
    try{
      receiverAddress = web3.utils.toChecksumAddress(receiveAddr);  //explain addresses,formats and checksumming
    }catch(e){
      alert("You should input valid receiver address!"); console.log(e);
    }

    // error handling in fromAmount input
    if (fromAmount <= 0) {
      alert("Invalid amount entered");
      return;
    }
    const tradeAmount = fromAmount.toString();

    let max_trade_life = 20; // trade live cycle time

    const fromTokenData = new Token(chainId, erc20Tokens[fromToken].address, erc20Tokens[fromToken].decimals);

    const route = await getRoute(fromToken, toToken);

    const tradeAmountWei = web3.utils.toWei(tradeAmount); // convert input amount in wei
    const tradeAmountBN = new TokenAmount(fromTokenData, JSBI.BigInt(tradeAmountWei)); //convert tradeamount wei to BigInt
    const trade = new Trade(route, tradeAmountBN, TradeType.EXACT_INPUT);

    const execution_price = trade.executionPrice.toSignificant(6); //trading execution price
    const nextMidPrice = trade.nextMidPrice.toSignificant(6);     // trading next mid price

    const slippageTolerance = new Percent('50', '10000') // 50 bips, or 0.50%

    console.log(execution_price);
    console.log(nextMidPrice);

    // convert input amount back to wei
    const amountIn = web3.utils.soliditySha3(tradeAmountWei);

    const amountoutMinWei = web3.utils.toWei(trade.minimumAmountOut(slippageTolerance).toExact()); // needs to be converted to e.g. hex
    const amountOutMin = web3.utils.soliditySha3(amountoutMinWei);

    const path = [erc20Tokens[fromToken].address, erc20Tokens[toToken].address];
    const to = receiverAddress;
    const deadline = web3.utils.soliditySha3(Math.floor(Date.now() / 1000) + 60 * max_trade_life); // 20 minutes from the current time
    let gasPrice = await web3.eth.getGasPrice(); // gas price

    // aprove swap amount from token address
    const fromContract = new web3.eth.Contract(JSON.parse(ABIS[fromToken]), erc20Tokens[fromToken].address);
    const approve_tx = await fromContract.methods.approve(UniSwapV2Addrs, amountIn).call();
    console.log(approve_tx);

    // swap contract
    const UniswapV2Router02Contract = new web3.eth.Contract(JSON.parse(ABIS['UniswapV2Router02']), UniSwapV2Addrs,{gasPrice:gasPrice});
    const tx = await UniswapV2Router02Contract.methods.swapExactTokensForTokens(
        amountIn,
        amountOutMin,
        path,
        to,
        deadline
    ).call();

    console.log('Tx Hash:', tx);
  }

  //handle changes of form gruop inputs
  async function handleChange(value,type){
    // new token types and amounts from input.
    let fromNewToken = fromToken;
    let toNewToken = toToken;
    let fromNewAmount = fromAmount;
    let toNewAmount = toAmount;

    // switch case according to different input values.
    switch(type){
      case 'fromToken':
        setFromToken(value);
        fromNewToken = value;
        break;
      case 'toToken':
        setToToken(value);
        toNewToken = value;
        break;
      case 'fromAmount':
        setFromAmount(value);
        fromNewAmount = value;
        break;
      case 'toAmount':
        setToAmount(value);
        toNewAmount = value;
        break;
      default:
        break;
    }
    await calculateSwap(fromNewToken, toNewToken, fromNewAmount, toNewAmount, type); // calculate swap ratio
  }

  // getRoute of token pairs
  async function getRoute(fromNewToken, toNewToken){
    // TokenDatas for fetch pair address
    const fromTokenData = new Token(chainId, erc20Tokens[fromNewToken].address, erc20Tokens[fromNewToken].decimals);
    const toTokenData = new Token(chainId, erc20Tokens[toNewToken].address, erc20Tokens[toNewToken].decimals);

    const pair = await Fetcher.fetchPairData(fromTokenData, toTokenData); // pair data between sender and receiver
    const route = new Route([pair], fromTokenData); //route data

    return route;
  }

  //calculate swap ratio amount
  async function calculateSwap(fromNewToken, toNewToken, fromNewAmount, toNewAmount, type){
    const route = await getRoute(fromNewToken, toNewToken, fromNewAmount, toNewAmount);
    const fromTo = route.midPrice.toSignificant(6);
    const toFrom = route.midPrice.invert().toSignificant(6);

    // if sender or receiver amount value changed
    if(type === "toAmount"){
      setFromAmount(toNewAmount * toFrom);
    }else{
      setToAmount(fromNewAmount * fromTo);
    }
  }

  return (
      <div className="container">
        <div className="row">
          <div className="col-sm" style={{marginBottom:'100px', marginTop:'100px'}}>
            <div className="card">
                <div className="card-header">
                    Receiver Address
                </div>
                <div className="card-body">
                    <h5>Enter token receiver address</h5>
                    <input type="text" 
                        className="form-control"
                        id="tokenAddr"
                        onChange={(val)=>setReceiveAddr(val.target.value)}
                        aria-label="Ether amount (with dot and two decimal places)" />
                </div>
            </div>
          </div>
        </div>
        <div className="row">
            <div className="col-sm">
                <div className="card">
                    <div className="card-header">
                        Uniswap: ETH - ERC20 , ERC20 - ETH, ERC20 - ERC20
                    </div>
                    <div className="card-body">
                        <div className="container">
                          <h5>Sender</h5>
                          <div className="input-group">
                              <input type="text" 
                                  className="form-control"
                                  id="from_amount"
                                  value={fromAmount}
                                  onChange={(val)=>handleChange(val.target.value,'fromAmount')}
                                  aria-label="From amount (with dot and two decimal places)" />
                              <select defaultValue={fromToken} onChange={(val)=>handleChange(val.target.value,'fromToken')}>
                                {tokenList.map(token => token === toToken ? <option key={token} value={token} disabled>{token}</option>:<option key={token} value={token}>{token}</option>)}
                              </select>                          
                          </div>
                          <h5 style={{marginTop:'10px'}}>Receiver</h5>
                          <div className="input-group">
                              <input type="text" 
                                  className="form-control"
                                  id="to_amount"
                                  value={toAmount}
                                  onChange={(val)=>handleChange(val.target.value,'toAmount')}
                                  aria-label="To amount (with dot and two decimal places)"/>
                              <select defaultValue={toToken} onChange={(val)=>handleChange(val.target.value,'toToken')}>
                                {tokenList.map(token => token === fromToken ? <option key={token} value={token} disabled>{token}</option>:<option key={token} value={token}>{token}</option>)}
                              </select>
                          </div>
                          {
                            !walletConnected && <Button className="btn btn-primary" style={{marginTop:'20px'}} onClick={()=>connectWallet()} >Connect Wallet</Button>
                          }
                          {
                            walletConnected && <Button className="btn btn-primary" style={{marginTop:'20px'}} onClick={()=>swapTokens()}>SWAP TOKENS</Button>
                          }
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </div>
  );
}

export default App;
